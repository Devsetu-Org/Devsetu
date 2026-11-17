'use strict';

/**
 * Reverse-proxy Spark Master/Worker Web UIs into the learner browser.
 * Frontend opens /api/session/:id/spark-ui/:node/… — UIs are in-cluster only,
 * so we hold a kubectl port-forward and rewrite HTML like the compose browse proxy.
 */

import type { ExpressRequest, ExpressResponse } from '../types/express';
import type { GameSession } from '../types/domain';
import type { ChildProcess } from 'child_process';
import type { IncomingMessage, OutgoingHttpHeaders } from 'http';

const http = require('http');
const { spawn } = require('child_process');
const sessionStore = require('../db/sessionStore');
const loader = require('../challenges/loader');
const k8s = require('./k8sCluster');
const sparkBox = require('./sparkBox');

const AGENT = new http.Agent({ keepAlive: false });
const IDLE_MS = 5 * 60_000;

interface Forward {
  localPort: number;
  child: ChildProcess;
  lastUsed: number;
  key: string;
}

const forwards = new Map<string, Forward>();
/** One in-flight port-forward per key — parallel UI asset requests must not race-spawn. */
const forwardWaiters = new Map<string, Promise<number>>();

function uiPortForNode(node: string, shape?: string): { pod: string; port: number } | null {
  const raw = String(node || '').trim();
  if (!raw) return null;
  const yarn = shape === 'yarn-2' || raw === 'rm' || raw.startsWith('nm-');
  // Client-mode driver Application UI (Spark UI on 4040) lives on the shell.
  if (raw === sparkBox.SHELL || raw === 'shell' || raw === 'app' || raw === 'driver') {
    return { pod: sparkBox.SHELL, port: 4040 };
  }
  if (raw === sparkBox.MASTER || raw === 'master' || raw === 'spark-master' || raw === 'rm') {
    return {
      pod: sparkBox.MASTER,
      port: yarn || shape === 'yarn-2' ? sparkBox.YARN_RM_UI_PORT : 8080,
    };
  }
  // Prefer YARN NM port when the session shape is yarn-2.
  if (shape === 'yarn-2') {
    const nms = sparkBox.workersFor('yarn-2');
    const nm = nms.find((w: { name: string }) => w.name === raw);
    if (nm) return { pod: nm.name, port: nm.uiPort };
  }
  const workers = sparkBox.workersFor(shape === 'spark-2' ? 'spark-2' : 'spark-3');
  const hit = workers.find((w: { name: string }) => w.name === raw);
  if (hit) return { pod: hit.name, port: hit.uiPort };
  // Legacy names from before DevSetu host inventory.
  const legacy: Record<string, string> = {
    'worker-0': 'ds-spark-02',
    'worker-1': 'ds-spark-03',
    'worker-2': 'ds-spark-04',
  };
  if (legacy[raw]) return uiPortForNode(legacy[raw], shape);
  return null;
}

function parseSubPath(originalUrl: string, sessionId: string, node: string): string {
  const prefix = `/api/session/${sessionId}/spark-ui/${node}`;
  const pathOnly = originalUrl.split('?')[0];
  let sub = pathOnly.startsWith(prefix) ? pathOnly.slice(prefix.length) : '';
  if (!sub) sub = '/';
  if (!sub.startsWith('/')) sub = `/${sub}`;
  // uiRoot + "/api/…" must not become "//api/…" on the upstream Spark UI.
  while (sub.startsWith('//')) sub = sub.slice(1);
  const q = originalUrl.includes('?') ? originalUrl.slice(originalUrl.indexOf('?')) : '';
  return sub + q;
}

function stripFrameBlockingHeaders(headers: Record<string, unknown>): Record<string, unknown> {
  const out = { ...headers };
  delete out['x-frame-options'];
  delete out['content-security-policy'];
  delete out['content-security-policy-report-only'];
  delete out['cross-origin-opener-policy'];
  delete out['cross-origin-embedder-policy'];
  return out;
}

function browseBaseHref(baseHref: string): string {
  return baseHref.endsWith('/') ? baseHref : `${baseHref}/`;
}

/** In-cluster host:port → /api/session/…/spark-ui/<node> (no trailing slash). */
function clusterUiProxyBases(sessionId: string, shape: string): Array<{ hostPort: string; proxyBase: string }> {
  const prefix = `/api/session/${sessionId}/spark-ui`;
  const yarn = shape === 'yarn-2';
  const out: Array<{ hostPort: string; proxyBase: string }> = [];
  if (yarn) {
    out.push({ hostPort: `${sparkBox.MASTER}:${sparkBox.YARN_RM_UI_PORT}`, proxyBase: `${prefix}/${sparkBox.MASTER}` });
    for (const nm of sparkBox.workersFor('yarn-2') as Array<{ name: string; uiPort: number }>) {
      out.push({ hostPort: `${nm.name}:${nm.uiPort}`, proxyBase: `${prefix}/${nm.name}` });
    }
  } else {
    out.push({ hostPort: `${sparkBox.MASTER}:8080`, proxyBase: `${prefix}/${sparkBox.MASTER}` });
    const workers = sparkBox.workersFor(shape === 'spark-2' ? 'spark-2' : 'spark-3') as Array<{ name: string; uiPort: number }>;
    for (const w of workers) {
      out.push({ hostPort: `${w.name}:${w.uiPort}`, proxyBase: `${prefix}/${w.name}` });
    }
    // Client-mode driver Application UI — Master app links use http://shell:4040.
    out.push({ hostPort: `${sparkBox.SHELL}:4040`, proxyBase: `${prefix}/${sparkBox.SHELL}` });
  }
  // Longer host:port first so overlapping prefixes cannot partial-match.
  out.sort((a, b) => b.hostPort.length - a.hostPort.length);
  return out;
}

/** Master↔Worker (and YARN) links use http://ds-spark-N:port — send them through our proxy. */
function rewriteClusterHostUrls(text: string, bases: Array<{ hostPort: string; proxyBase: string }>): string {
  if (!bases.length) return text;
  let out = text;
  for (const { hostPort, proxyBase } of bases) {
    const escaped = hostPort.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(`https?://${escaped}`, 'gi'), proxyBase);
  }
  return out;
}

function rewriteRootAbsoluteUrls(html: string, baseHref: string): string {
  // href/src need a trailing slash so "/static/x" → "…/shell/static/x".
  const assetBase = browseBaseHref(baseHref);
  // setUIRoot must NOT end with "/" — Spark does uiRoot + "/api/v1/…" and
  // uiRoot + "/static/…". A trailing slash yields "//api" which breaks the
  // Jobs tables / executors AJAX on first paint behind this proxy.
  const uiRoot = assetBase.replace(/\/+$/, '') || assetBase;
  let out = html;
  out = out.replace(
    /(\s(?:href|src|action)=["'])\/([^"'#?][^"']*)/gi,
    (_: string, attr: string, p: string) => `${attr}${assetBase}${p}`,
  );
  out = out.replace(
    /(\s(?:href|src)=["'])\/(["'])/gi,
    (_: string, attr: string, close: string) => `${attr}${assetBase}${close}`,
  );
  out = out.replace(/setUIRoot\(\s*['"][^'"]*['"]\s*\)/g, `setUIRoot('${uiRoot}')`);
  // If the page never called setUIRoot (some builds), force uiRoot before other scripts run.
  if (!/setUIRoot\s*\(/.test(html) && /<\/head>/i.test(out)) {
    out = out.replace(/<\/head>/i, `<script>window.uiRoot=${JSON.stringify(uiRoot)};</script></head>`);
  }
  return out;
}

function rewriteHtml(
  html: string,
  baseHref: string,
  clusterBases: Array<{ hostPort: string; proxyBase: string }>,
): string {
  // Do NOT inject <base href>. Spark stage/job pages call getBaseURI() →
  // document.baseURI and parse ?id= / ?attempt= from it. A <base> makes
  // baseURI the base path (no query), so stagepage.js throws and the UI
  // sticks on "Loading Stage Page…". Absolute /static and /api links are
  // rewritten instead; setUIRoot() covers REST calls.
  //
  // Same-node /static… links first, then Master↔Worker http://ds-spark-N:port → proxy.
  // Cluster rewrite must be last so those /api/session/… paths are not re-prefixed.
  const sameNode = rewriteRootAbsoluteUrls(html, baseHref);
  return rewriteClusterHostUrls(sameNode, clusterBases);
}

function rewriteRedirectLocation(
  loc: unknown,
  localPort: number,
  baseHref: string,
  clusterBases: Array<{ hostPort: string; proxyBase: string }>,
): unknown {
  if (!loc || typeof loc !== 'string') return loc;
  const viaCluster = rewriteClusterHostUrls(loc, clusterBases);
  if (viaCluster !== loc) return viaCluster;
  const base = browseBaseHref(baseHref);
  const localPrefix = `http://127.0.0.1:${localPort}`;
  if (viaCluster.startsWith(localPrefix)) return `${base}${viaCluster.slice(localPrefix.length)}`;
  if (viaCluster.startsWith('/')) return `${base}${viaCluster.slice(1)}`;
  return viaCluster;
}

function stopForward(entry: Forward): void {
  forwards.delete(entry.key);
  forwardWaiters.delete(entry.key);
  try {
    entry.child.kill('SIGTERM');
  } catch {
    /* ignore */
  }
}

function reapIdleForwards(): void {
  const now = Date.now();
  for (const entry of [...forwards.values()]) {
    if (now - entry.lastUsed > IDLE_MS) stopForward(entry);
  }
}

setInterval(reapIdleForwards, 60_000).unref?.();

async function ensureForward(ns: string, pod: string, targetPort: number): Promise<number> {
  const key = `${ns}/${pod}/${targetPort}`;
  const existing = forwards.get(key);
  if (existing && existing.child.exitCode == null && !existing.child.killed) {
    existing.lastUsed = Date.now();
    return existing.localPort;
  }

  const inFlight = forwardWaiters.get(key);
  if (inFlight) return inFlight;

  if (existing) stopForward(existing);

  const start = (async (): Promise<number> => {
    const cmd = await k8s.controllerKubectlCommand([
      'port-forward',
      '-n', ns,
      `pod/${pod}`,
      `:${targetPort}`,
    ]);

    const child: ChildProcess = spawn('kubectl', cmd.args, {
      env: cmd.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const localPort = await new Promise<number>((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        try { child.kill('SIGTERM'); } catch { /* ignore */ }
        reject(new Error(`port-forward to ${pod}:${targetPort} timed out`));
      }, 20_000);

      const onData = (buf: Buffer): void => {
        const text = buf.toString();
        const m = text.match(/Forwarding from 127\.0\.0\.1:(\d+)/);
        if (!m || settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(Number(m[1]));
      };
      child.stdout?.on('data', onData);
      child.stderr?.on('data', onData);
      child.on('error', (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(err);
      });
      child.on('exit', (code) => {
        forwards.delete(key);
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(new Error(`port-forward exited early (code ${code})`));
        }
      });
    });

    // Brief readiness probe — first HTML often races the listener and the Jobs
    // AJAX (/api/v1/applications) fails while the Event Timeline (inline) still paints.
    await new Promise<void>((resolve) => {
      const probe = http.request({
        hostname: '127.0.0.1',
        port: localPort,
        path: '/',
        method: 'GET',
        agent: AGENT,
        timeout: 3_000,
      }, (res: IncomingMessage) => {
        res.resume();
        resolve();
      });
      probe.on('error', () => resolve());
      probe.on('timeout', () => {
        probe.destroy();
        resolve();
      });
      probe.end();
    });

    const entry: Forward = { localPort, child, lastUsed: Date.now(), key };
    forwards.set(key, entry);
    return localPort;
  })();

  forwardWaiters.set(key, start);
  try {
    return await start;
  } finally {
    if (forwardWaiters.get(key) === start) forwardWaiters.delete(key);
  }
}

function shouldRewriteBody(method: string, contentType: string): boolean {
  if (method !== 'GET' && method !== 'HEAD') return false;
  const ctype = contentType.toLowerCase();
  return (
    ctype.includes('text/html')
    || ctype.includes('json')
    || ctype.includes('javascript')
    || ctype.includes('text/plain')
  );
}

function proxyOnce(
  localPort: number,
  subPath: string,
  method: string,
  req: IncomingMessage,
  baseHref: string,
  clusterBases: Array<{ hostPort: string; proxyBase: string }>,
): Promise<{ statusCode: number; headers: Record<string, unknown>; body: Buffer | string }> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(req.headers)) {
      const low = k.toLowerCase();
      if (['connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'host', 'accept-encoding'].includes(low)) continue;
      headers[k] = v;
    }
    headers.host = `127.0.0.1:${localPort}`;
    // Avoid gzip: we buffer + rewrite HTML as utf8; a leftover Content-Encoding breaks the browser.
    headers['accept-encoding'] = 'identity';

    const proxyReq = http.request({
      hostname: '127.0.0.1',
      port: localPort,
      path: subPath,
      method,
      headers,
      agent: AGENT,
      timeout: 30_000,
    }, (proxyRes: IncomingMessage) => {
      const ctype = String(proxyRes.headers['content-type'] || '');
      const rewrite = shouldRewriteBody(method, ctype);
      const chunks: Buffer[] = [];
      proxyRes.on('data', (c: Buffer) => chunks.push(c));
      proxyRes.on('end', () => {
        const raw = Buffer.concat(chunks);
        const outHeaders = stripFrameBlockingHeaders(proxyRes.headers as Record<string, unknown>);
        if (outHeaders.location) {
          outHeaders.location = rewriteRedirectLocation(
            outHeaders.location,
            localPort,
            baseHref,
            clusterBases,
          );
        }
        // Never claim compressed bytes after we may have rewritten the body.
        delete outHeaders['content-encoding'];
        delete outHeaders['content-length'];
        if (!rewrite) {
          resolve({
            statusCode: proxyRes.statusCode || 502,
            headers: { ...outHeaders, 'content-length': raw.length },
            body: raw,
          });
          return;
        }
        let body = raw.toString('utf8');
        try {
          body = ctype.toLowerCase().includes('text/html')
            ? rewriteHtml(body, baseHref, clusterBases)
            : rewriteClusterHostUrls(body, clusterBases);
        } catch { /* keep */ }
        resolve({
          statusCode: proxyRes.statusCode || 502,
          headers: { ...outHeaders, 'content-length': Buffer.byteLength(body) },
          body,
        });
      });
    });
    proxyReq.on('timeout', () => {
      proxyReq.destroy();
      reject(new Error('Spark UI timed out'));
    });
    proxyReq.on('error', reject);
    if (method !== 'GET' && method !== 'HEAD' && req.readable) {
      req.pipe(proxyReq);
    } else {
      proxyReq.end();
    }
  });
}

function notReadyPage(node: string, detail: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Spark UI</title>
<style>body{font-family:system-ui,sans-serif;background:#0a0a0a;color:#e5e5e5;padding:48px;max-width:40rem}
code{background:#1a1a1a;padding:2px 6px;border-radius:4px}</style></head><body>
<h1>Spark UI is not reachable on <code>${node}</code></h1>
<p>${detail}</p>
<p>For standalone labs, start the Master on <code>ds-spark-01</code> (and Workers on the other hosts). For YARN labs, wait until setup has started the ResourceManager and NodeManagers, then open the UI again.</p>
</body></html>`;
}

async function handleSparkUi(req: ExpressRequest, res: ExpressResponse): Promise<void> {
  const sessionId = req.params.id;
  const node = req.params.node;
  const session = sessionStore.get(sessionId) as (GameSession & { k8sNamespace?: string }) | null;

  if (!session || session.status !== 'active') {
    res.status(404).json({ error: 'session not found or not active' });
    return;
  }

  const ns = session.k8sNamespace || session.workspacePrefix;
  if (!ns) {
    res.status(404).json({ error: 'Spark cluster namespace missing on session' });
    return;
  }

  const challenge = loader.getChallenge(session.challengeId) as
    | { k8sPlatform?: { shape?: string } }
    | null;
  const shape = String(challenge?.k8sPlatform?.shape || '');
  const target = uiPortForNode(node, shape);
  if (!target) {
    res.status(404).json({ error: `unknown Spark node "${node}"` });
    return;
  }

  const subPath = parseSubPath(req.originalUrl, sessionId, node);
  const baseHref = `/api/session/${sessionId}/spark-ui/${node}`;
  const clusterBases = clusterUiProxyBases(sessionId, shape);

  // Master / Open-UI links often omit the trailing slash. Relative Spark links then
  // resolve under /spark-ui/ instead of /spark-ui/<node>/ and the Jobs pane stays empty
  // until a manual refresh lands on a slash-terminated URL.
  if ((subPath === '/' || subPath === '') && !String(req.originalUrl.split('?')[0]).endsWith('/')) {
    const q = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
    res.redirect(302, `${baseHref}/${q}`);
    return;
  }

  let localPort: number;
  try {
    localPort = await ensureForward(ns, target.pod, target.port);
  } catch (err: unknown) {
    const msg = (err as Error).message || String(err);
    console.warn(`[spark-ui] port-forward failed ns=${ns} pod=${target.pod}: ${msg}`);
    res.status(503).type('html').send(notReadyPage(node, 'Could not open a tunnel to this host. Is the node up?'));
    return;
  }

  const key = `${ns}/${target.pod}/${target.port}`;
  try {
    let out = await proxyOnce(localPort, subPath, req.method, req, baseHref, clusterBases);
    // Cold tunnel: first API/HTML hop sometimes fails; one retry after dropping the forward.
    if (out.statusCode >= 500 || out.statusCode === 502) {
      const entry = forwards.get(key);
      if (entry) stopForward(entry);
      localPort = await ensureForward(ns, target.pod, target.port);
      out = await proxyOnce(localPort, subPath, req.method, req, baseHref, clusterBases);
    }
    const entry = forwards.get(key);
    if (entry) entry.lastUsed = Date.now();
    res.writeHead(out.statusCode, out.headers as OutgoingHttpHeaders);
    res.end(out.body);
  } catch (err: unknown) {
    const msg = (err as Error).message || String(err);
    console.warn(`[spark-ui] proxy error session=${sessionId} node=${node}: ${msg}`);
    // Drop a dead forward so the next click retries.
    const entry = forwards.get(key);
    if (entry) stopForward(entry);
    if (!res.headersSent) {
      res.status(503).type('html').send(
        notReadyPage(node, 'The UI process is not listening yet (daemon not started, or still booting).'),
      );
    }
  }
}

function dropForwardsForNamespace(ns: string): void {
  for (const entry of [...forwards.values()]) {
    if (entry.key.startsWith(`${ns}/`)) stopForward(entry);
  }
}

module.exports = {
  handleSparkUi,
  uiPortForNode,
  dropForwardsForNamespace,
};
