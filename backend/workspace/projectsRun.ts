'use strict';

/**
 * Ephemeral project-module Runs on labs-projects.
 *
 * No standing shell: create a short-lived pod, sync the browser workspace,
 * run verify commands (make test / race / …), collect logs, delete the pod.
 *
 * Env:
 *   PROJECTS_LAB_IMAGE — default devsetu/projects-lab:v0.1
 *   PROJECTS_RUN_TIMEOUT_S — wall clock for the whole run (default 300)
 *   PROJECTS_RUN_CMD_TIMEOUT_S — per-command timeout (default 180)
 */

const { spawn, spawnSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const k8s = require('./k8sCluster');
const { sanitizeOwner } = require('./workspaceStore');

const IMAGE = process.env.PROJECTS_LAB_IMAGE || 'devsetu/projects-lab:v0.1';
const RUN_TIMEOUT_MS = Math.max(60, Number(process.env.PROJECTS_RUN_TIMEOUT_S || 300)) * 1000;
const CMD_TIMEOUT_MS = Math.max(30, Number(process.env.PROJECTS_RUN_CMD_TIMEOUT_S || 180)) * 1000;
const READY_TIMEOUT_S = Math.max(60, Number(process.env.PROJECTS_RUN_READY_TIMEOUT_S || 300));
const MAX_FILES = 200;
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_LOG_CHARS = 200_000;
const POD = 'run';
const CONTAINER = 'box';
const WORK = '/home/learner/work';

/** Allowlisted verify commands only. */
const CMD_RE = /^make(\s+(test|race|asan|bench|run|vet))?$/;

type RunStatus = 'queued' | 'starting' | 'running' | 'succeeded' | 'failed' | 'cancelled';

type ProjectRun = {
  id: string;
  userId: string;
  persistId: string;
  status: RunStatus;
  logs: string;
  exitCode: number | null;
  error: string | null;
  createdAt: number;
  finishedAt: number | null;
  ns: string;
  abort: AbortController;
  promise: Promise<void> | null;
};

const runs = new Map<string, ProjectRun>();

function publicRun(run: ProjectRun): Record<string, unknown> {
  return {
    id: run.id,
    persistId: run.persistId,
    status: run.status,
    logs: run.logs,
    exitCode: run.exitCode,
    error: run.error,
    createdAt: run.createdAt,
    finishedAt: run.finishedAt,
  };
}

function appendLog(run: ProjectRun, chunk: string): void {
  const next = `${run.logs}${chunk}`;
  run.logs = next.length > MAX_LOG_CHARS
    ? `…(truncated)…\n${next.slice(next.length - MAX_LOG_CHARS)}`
    : next;
}

function runError(status: number, code: string, message: string): Error {
  return Object.assign(new Error(message), { status, code });
}

function namespaceFor(userId: string): string {
  const owner = sanitizeOwner(userId || 'anonymous').toLowerCase();
  const base = `pr-${owner}`.replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
  return base.slice(0, 63).replace(/-$/, '') || 'pr-anonymous';
}

function labelValue(raw: string): string {
  return raw.replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 63).replace(/[^A-Za-z0-9]+$/, '') || 'run';
}

function validateFiles(files: Record<string, string>): void {
  const paths = Object.keys(files || {});
  if (paths.length === 0) throw runError(400, 'NO_FILES', 'Workspace has no files to run.');
  if (paths.length > MAX_FILES) {
    throw runError(413, 'TOO_MANY_FILES', `At most ${MAX_FILES} files per run.`);
  }
  let bytes = 0;
  for (const [rel, content] of Object.entries(files)) {
    const p = String(rel || '').replace(/\\/g, '/').replace(/^\/+/, '');
    if (!p || p.includes('..') || p.startsWith('/') || p.includes('\0')) {
      throw runError(400, 'BAD_PATH', `Invalid path: ${rel}`);
    }
    bytes += Buffer.byteLength(String(content ?? ''), 'utf8');
    if (bytes > MAX_BYTES) {
      throw runError(413, 'WORKSPACE_TOO_LARGE', `Workspace exceeds ${MAX_BYTES} bytes.`);
    }
  }
}

function validateCommands(commands: string[]): string[] {
  const list = (commands || []).map((c) => String(c || '').trim()).filter(Boolean);
  if (list.length === 0) throw runError(400, 'NO_COMMANDS', 'No verify commands for this chapter.');
  for (const cmd of list) {
    if (!CMD_RE.test(cmd)) {
      throw runError(400, 'BAD_COMMAND', `Command not allowed: ${cmd}`);
    }
  }
  return list;
}

function namespaceYaml(ns: string): string {
  return `
apiVersion: v1
kind: Namespace
metadata:
  name: ${ns}
  labels:
    app.kubernetes.io/managed-by: devlabs
    app.kubernetes.io/component: projects-lab
    pod-security.kubernetes.io/enforce: baseline
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: dl-box-isolation
  namespace: ${ns}
  labels:
    app.kubernetes.io/managed-by: devlabs
spec:
  podSelector: {}
  policyTypes: [Ingress, Egress]
  ingress:
    - from:
        - podSelector: {}
  egress:
    - to:
        - podSelector: {}
    - to:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: kube-system
          podSelector:
            matchLabels:
              k8s-app: kube-dns
      ports:
        - {protocol: UDP, port: 53}
        - {protocol: TCP, port: 53}
`;
}

function podYaml(ns: string, persistId: string, runId: string): string {
  const deadline = Math.ceil(RUN_TIMEOUT_MS / 1000) + 60;
  return `
apiVersion: v1
kind: Pod
metadata:
  name: ${POD}
  namespace: ${ns}
  labels:
    app: projects-run
    app.kubernetes.io/managed-by: devlabs
    app.kubernetes.io/component: projects-lab
    devlabs.io/run-id: ${labelValue(runId)}
    devlabs.io/persist-id: ${labelValue(persistId)}
  annotations:
    karpenter.sh/do-not-disrupt: "true"
spec:
  hostname: projects-run
  automountServiceAccountToken: false
  enableServiceLinks: false
  restartPolicy: Never
  activeDeadlineSeconds: ${deadline}
  terminationGracePeriodSeconds: 5
  nodeSelector:
    devlabs.io/pool: projects
  tolerations:
    - key: devlabs.io/pool
      value: projects
      effect: NoSchedule
  affinity:
    nodeAffinity:
      preferredDuringSchedulingIgnoredDuringExecution:
        - weight: 100
          preference:
            matchExpressions:
              - key: devlabs.io/tier
                operator: In
                values: ["base"]
  containers:
    - name: ${CONTAINER}
      image: ${IMAGE}
      imagePullPolicy: IfNotPresent
      command: ["sleep", "infinity"]
      workingDir: ${WORK}
      env:
        - { name: GOPROXY, value: "off" }
        - { name: GOFLAGS, value: "-mod=mod" }
        - { name: HOME, value: "/home/learner" }
      securityContext:
        allowPrivilegeEscalation: false
        runAsNonRoot: true
        runAsUser: 1000
        runAsGroup: 1000
        capabilities:
          drop: ["ALL"]
        seccompProfile:
          type: RuntimeDefault
      resources:
        requests:
          cpu: 100m
          memory: 256Mi
          ephemeral-storage: 1Gi
        limits:
          cpu: "1"
          memory: 1Gi
          ephemeral-storage: 4Gi
`;
}

async function ensureNamespace(ns: string): Promise<void> {
  await k8s.kubectlOk(['apply', '-f', '-'], { input: namespaceYaml(ns), timeoutMs: 30_000 });
}

async function deleteRunPod(ns: string): Promise<void> {
  await k8s.kubectlOk(
    ['delete', 'pod', POD, '-n', ns, '--ignore-not-found', '--grace-period=1', '--wait=false'],
    { timeoutMs: 30_000 },
  ).catch(() => undefined);
}

async function createPod(ns: string, persistId: string, runId: string): Promise<void> {
  await deleteRunPod(ns);
  await k8s.kubectlOk(['apply', '-f', '-'], {
    input: podYaml(ns, persistId, runId),
    timeoutMs: 30_000,
  });
  const ready = await k8s.runKubectl(
    ['wait', '--for=condition=Ready', `pod/${POD}`, '-n', ns, `--timeout=${READY_TIMEOUT_S}s`],
    { timeoutMs: (READY_TIMEOUT_S + 15) * 1000 },
  );
  if (ready.code !== 0) {
    const describe = await k8s.runKubectl(
      ['describe', 'pod', POD, '-n', ns],
      { timeoutMs: 20_000 },
    ).catch(() => ({ stdout: '', stderr: '' }));
    throw runError(
      503,
      'POD_NOT_READY',
      `Projects runner did not become Ready.\n${(describe.stdout || describe.stderr || ready.stderr || '').slice(0, 1500)}`,
    );
  }
}

function writeWorkspaceTree(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dl-projects-run-'));
  for (const [relRaw, content] of Object.entries(files)) {
    const rel = String(relRaw).replace(/\\/g, '/').replace(/^\/+/, '');
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, String(content ?? ''), 'utf8');
  }
  return root;
}

function makeTar(workDir: string): string {
  const tarPath = path.join(os.tmpdir(), `dl-projects-run-${crypto.randomBytes(6).toString('hex')}.tar`);
  const packed = spawnSync('tar', ['cf', tarPath, '-C', workDir, '.'], { encoding: 'utf8' });
  if (packed.status !== 0) {
    fs.rmSync(tarPath, { force: true });
    throw runError(500, 'TAR_FAILED', packed.stderr || 'Could not pack workspace.');
  }
  return tarPath;
}

function streamTarToPod(ns: string, tarPath: string, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const fail = (err: Error): void => {
      if (settled) return;
      settled = true;
      reject(err);
    };
    void k8s.controllerKubectlCommand([
      'exec', '-i', '-n', ns, POD, '-c', CONTAINER, '--',
      'tar', 'xf', '-', '-C', WORK,
    ]).then(
      (cmd: { args: string[]; env: NodeJS.ProcessEnv }) => {
        if (signal.aborted) {
          fail(runError(499, 'CANCELLED', 'Run cancelled.'));
          return;
        }
        const child = spawn('kubectl', cmd.args, { env: cmd.env, stdio: ['pipe', 'pipe', 'pipe'] });
        let stderr = '';
        const onAbort = (): void => {
          child.kill('SIGKILL');
          fail(runError(499, 'CANCELLED', 'Run cancelled.'));
        };
        signal.addEventListener('abort', onAbort, { once: true });
        child.stderr?.on('data', (chunk: Buffer) => {
          if (stderr.length < 4000) stderr += chunk.toString('utf8');
        });
        child.on('error', (err: Error) => {
          signal.removeEventListener('abort', onAbort);
          fail(err);
        });
        child.on('close', (code: number | null) => {
          signal.removeEventListener('abort', onAbort);
          if (settled) return;
          settled = true;
          if (signal.aborted) {
            reject(runError(499, 'CANCELLED', 'Run cancelled.'));
            return;
          }
          if (code !== 0) {
            reject(runError(502, 'SYNC_FAILED', stderr.trim() || `tar extract exited ${code}`));
            return;
          }
          resolve();
        });
        fs.createReadStream(tarPath)
          .on('error', (err: Error) => fail(err))
          .pipe(child.stdin);
      },
      (err: Error) => fail(err),
    );
  });
}

async function syncFiles(
  ns: string,
  files: Record<string, string>,
  signal: AbortSignal,
): Promise<void> {
  const workDir = writeWorkspaceTree(files);
  let tarPath = '';
  try {
    await k8s.kubectlOk(
      ['exec', '-n', ns, POD, '-c', CONTAINER, '--', 'bash', '-lc', `mkdir -p ${WORK} && find ${WORK} -mindepth 1 -delete`],
      { timeoutMs: 30_000 },
    );
    tarPath = makeTar(workDir);
    await streamTarToPod(ns, tarPath, signal);
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
    if (tarPath) fs.rmSync(tarPath, { force: true });
  }
}

/**
 * Run a verify command inside the pod, streaming stdout/stderr into the run
 * log as it arrives so the UI can show tests finishing one by one.
 */
function streamExecCommand(
  ns: string,
  cmd: string,
  signal: AbortSignal,
  onChunk: (chunk: string) => void,
): Promise<{ code: number }> {
  if (signal.aborted) return Promise.reject(runError(499, 'CANCELLED', 'Run cancelled.'));

  // Verbose + line-buffered so individual cases stream into the Results UI.
  // Newlines (not `;` after then/else) — bash rejects `then; cmd`.
  const forceVerbose = /^(make\s+)?(test|race|asan)$/.test(cmd.trim());
  const script = [
    'set +e',
    `cd ${WORK} || exit 127`,
    'export PYTHONUNBUFFERED=1',
    forceVerbose ? 'export GOFLAGS="-v"' : 'true',
    'if command -v stdbuf >/dev/null 2>&1; then',
    `  stdbuf -oL -eL ${cmd}`,
    'else',
    `  ${cmd}`,
    'fi',
    'exit $?',
  ].join('\n');

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn: () => void): void => {
      if (settled) return;
      settled = true;
      fn();
    };

    void k8s.controllerKubectlCommand([
      'exec', '-n', ns, POD, '-c', CONTAINER, '--', 'bash', '-lc', script,
    ]).then(
      (kubectlCmd: { args: string[]; env: NodeJS.ProcessEnv }) => {
        if (signal.aborted) {
          finish(() => reject(runError(499, 'CANCELLED', 'Run cancelled.')));
          return;
        }
        const child = spawn('kubectl', kubectlCmd.args, {
          env: kubectlCmd.env,
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        let carry = '';
        const flush = (raw: string): void => {
          carry += raw;
          const parts = carry.split('\n');
          carry = parts.pop() || '';
          for (const line of parts) onChunk(`${line}\n`);
        };
        const timer = setTimeout(() => {
          child.kill('SIGKILL');
          finish(() => reject(Object.assign(
            new Error(`Command timed out after ${CMD_TIMEOUT_MS}ms`),
            { status: 504, code: 'TIMEOUT' },
          )));
        }, CMD_TIMEOUT_MS);
        const onAbort = (): void => {
          child.kill('SIGKILL');
          finish(() => reject(runError(499, 'CANCELLED', 'Run cancelled.')));
        };
        signal.addEventListener('abort', onAbort, { once: true });
        child.stdout?.on('data', (chunk: Buffer) => flush(chunk.toString('utf8')));
        child.stderr?.on('data', (chunk: Buffer) => flush(chunk.toString('utf8')));
        child.on('error', (err: Error) => {
          clearTimeout(timer);
          signal.removeEventListener('abort', onAbort);
          finish(() => reject(err));
        });
        child.on('close', (code: number | null) => {
          clearTimeout(timer);
          signal.removeEventListener('abort', onAbort);
          if (carry) onChunk(carry.endsWith('\n') ? carry : `${carry}\n`);
          if (signal.aborted) {
            finish(() => reject(runError(499, 'CANCELLED', 'Run cancelled.')));
            return;
          }
          finish(() => resolve({ code: code ?? 1 }));
        });
      },
      (err: Error) => finish(() => reject(err)),
    );
  });
}

async function executeRun(
  run: ProjectRun,
  files: Record<string, string>,
  commands: string[],
): Promise<void> {
  const { signal } = run.abort;
  try {
    run.status = 'starting';
    appendLog(run, 'Scheduling ephemeral projects-lab runner…\n');
    appendLog(run, `Image ${IMAGE}\n`);
    await ensureNamespace(run.ns);
    if (signal.aborted) throw runError(499, 'CANCELLED', 'Run cancelled.');

    try {
      const poolAutoscale = require('./poolAutoscale');
      appendLog(run, 'Ensuring projects capacity…\n');
      await poolAutoscale.ensurePoolAwake('projects', {
        onPhase: (msg: string) => appendLog(run, `${msg}\n`),
      });
    } catch (err) {
      throw runError(
        (err as { status?: number }).status || 503,
        (err as { code?: string }).code || 'LAB_ENV_UNAVAILABLE',
        (err as Error).message || 'Projects lab machines are offline.',
      );
    }
    if (signal.aborted) throw runError(499, 'CANCELLED', 'Run cancelled.');

    appendLog(run, 'Waiting for runner pod…\n');
    await createPod(run.ns, run.persistId, run.id);
    if (signal.aborted) throw runError(499, 'CANCELLED', 'Run cancelled.');

    appendLog(run, `Uploading workspace (${Object.keys(files).length} files)…\n`);
    await syncFiles(run.ns, files, signal);
    appendLog(run, 'Workspace synced.\n');

    run.status = 'running';
    let failed = false;
    let lastCode = 0;
    for (const cmd of commands) {
      if (signal.aborted) throw runError(499, 'CANCELLED', 'Run cancelled.');
      appendLog(run, `\n$ ${cmd}\n`);
      const result = await streamExecCommand(run.ns, cmd, signal, (chunk) => {
        appendLog(run, chunk);
      });
      lastCode = result.code;
      if (result.code !== 0) {
        appendLog(run, `[exit ${result.code}]\n`);
        failed = true;
        break;
      }
      appendLog(run, '[ok]\n');
    }

    run.exitCode = lastCode;
    run.status = failed ? 'failed' : 'succeeded';
    appendLog(run, failed ? '\nRun failed.\n' : '\nRun succeeded.\n');
    appendLog(run, 'Runner released.\n');
  } catch (err) {
    if (signal.aborted || (err as { code?: string }).code === 'CANCELLED') {
      run.status = 'cancelled';
      run.error = 'Run cancelled.';
      appendLog(run, '\nRun cancelled. Runner released.\n');
    } else {
      run.status = 'failed';
      run.error = err instanceof Error ? err.message : 'Run failed.';
      appendLog(run, `\n${run.error}\n`);
    }
  } finally {
    run.finishedAt = Date.now();
    await deleteRunPod(run.ns);
  }
}

function activeRunForUser(userId: string): ProjectRun | null {
  for (const run of runs.values()) {
    if (run.userId === userId && (run.status === 'queued' || run.status === 'starting' || run.status === 'running')) {
      return run;
    }
  }
  return null;
}

function startRun(opts: {
  userId: string;
  persistId: string;
  files: Record<string, string>;
  commands: string[];
}): { run: Record<string, unknown> } {
  const userId = sanitizeOwner(opts.userId || '');
  if (!userId || userId === 'anonymous') {
    throw runError(401, 'AUTH_REQUIRED', 'Sign in to run.');
  }
  validateFiles(opts.files);
  const commands = validateCommands(opts.commands);

  const existing = activeRunForUser(userId);
  if (existing) {
    throw runError(409, 'RUN_IN_PROGRESS', 'A run is already in progress. Stop it before starting another.');
  }

  const id = crypto.randomBytes(8).toString('hex');
  const run: ProjectRun = {
    id,
    userId,
    persistId: String(opts.persistId || '').slice(0, 160),
    status: 'queued',
    logs: '',
    exitCode: null,
    error: null,
    createdAt: Date.now(),
    finishedAt: null,
    ns: namespaceFor(userId),
    abort: new AbortController(),
    promise: null,
  };
  runs.set(id, run);

  // Keep a bounded history so GET still works after finish.
  for (const [rid, old] of runs) {
    if (old.userId !== userId || rid === id) continue;
    if (old.finishedAt && Date.now() - old.finishedAt > 30 * 60 * 1000) runs.delete(rid);
  }

  run.promise = executeRun(run, opts.files, commands).catch(() => undefined);
  return { run: publicRun(run) };
}

function getRun(userId: string, runId: string): Record<string, unknown> {
  const owner = sanitizeOwner(userId || '');
  const run = runs.get(String(runId || ''));
  if (!run || run.userId !== owner) {
    throw runError(404, 'NOT_FOUND', 'Run not found.');
  }
  return publicRun(run);
}

async function cancelRun(userId: string, runId: string): Promise<Record<string, unknown>> {
  const owner = sanitizeOwner(userId || '');
  const run = runs.get(String(runId || ''));
  if (!run || run.userId !== owner) {
    throw runError(404, 'NOT_FOUND', 'Run not found.');
  }
  if (run.status === 'succeeded' || run.status === 'failed' || run.status === 'cancelled') {
    return publicRun(run);
  }
  run.abort.abort();
  run.status = 'cancelled';
  appendLog(run, '\nCancelling…\n');
  await deleteRunPod(run.ns);
  run.finishedAt = run.finishedAt || Date.now();
  return publicRun(run);
}

module.exports = {
  startRun,
  getRun,
  cancelRun,
  publicRun,
};
