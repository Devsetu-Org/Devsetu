#!/usr/bin/env node
/**
 * Local EKS ops dashboard (laptop + AWS admin profile).
 *
 *   aws sso login --profile devlabs-admin
 *   export AWS_PROFILE=devlabs-admin
 *   node deploy/eks/ops-dashboard/server.mjs
 *
 * Then open http://127.0.0.1:3920
 *
 * Binds localhost only. Runs deploy/eks scripts; one job at a time.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EKS_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(EKS_ROOT, '../..');
const PUBLIC = path.join(__dirname, 'public');
const HOST = '127.0.0.1';
const PORT = Number(process.env.EKS_OPS_PORT || 3920);

/** @type {Record<string, { label: string; section: string; summary: string; description: string; argv: string[]; env?: Record<string, string>; confirm?: string }>} */
const ACTIONS = {
  status: {
    label: 'Cluster status',
    section: 'control-plane',
    summary: 'Snapshot cluster, node groups, access, and add-ons.',
    description: [
      'Read-only health / drift check against the live AWS account and cluster. It does not change any capacity.',
      'Typical output covers: whether the EKS control plane exists and is ACTIVE; each managed node group (desired / min / max, status); access entries for the app IAM user; and managed add-ons (vpc-cni, coredns, kube-proxy, EBS CSI, metrics-server, and so on).',
      'Use this first when something looks wrong, or after sleep/wake/recreate, to confirm the cluster matches what you expect. Safe to run anytime with your admin profile.',
    ].join('\n\n'),
    argv: [path.join(EKS_ROOT, 'eks-status.sh')],
  },
  kubeconfig: {
    label: 'Refresh kubeconfig',
    section: 'control-plane',
    summary: 'Write local kubeconfig for kubectl.',
    description: [
      'Builds or refreshes the kubeconfig file used by local kubectl (and by this dashboard when it shells to cluster scripts).',
      'By default it writes ./kube/k8s-lab.kubeconfig under the repo. Override with KUBECONFIG or EKS_KUBECONFIG_OUT if you keep the file elsewhere.',
      'Run this after recreate, after SSO re-login, or when kubectl says the cluster is unreachable. It needs a living EKS control plane and AWS credentials that can call eks get-token / describe-cluster.',
    ].join('\n\n'),
    argv: [path.join(EKS_ROOT, 'eks-kubeconfig.sh')],
  },
  'wake-system': {
    label: 'Wake system-k8s',
    section: 'control-plane',
    summary: 'Scale system-k8s to Desired=1.',
    description: [
      'Scales only the system-k8s managed node group back up (Desired=1 by default from env.sh). That node is tainted CriticalAddonsOnly and labeled pool=system so learner workloads stay off it.',
      'Platform pieces that must run here include CoreDNS, metrics-server, EBS CSI controller, Karpenter controller, and Kyverno. Without a Ready system node those Deployments sit Pending and cluster DNS can break.',
      'This does not wake labs-k8s or labs-linux. After the node is Ready, follow with Pin add-ons if you have not already, then Karpenter / Kyverno as needed.',
    ].join('\n\n'),
    argv: [path.join(EKS_ROOT, 'eks-wake.sh')],
    env: { EKS_WAKE_NODEGROUPS: 'system-k8s' },
  },
  'sleep-system': {
    label: 'Sleep system-k8s',
    section: 'control-plane',
    summary: 'Scale system-k8s to Desired=0.',
    description: [
      'Parks only system-k8s by setting Desired=0. The EC2 instance drains and stops. The EKS control plane itself stays up and still bills (~$73/mo).',
      'Anything pinned to pool=system (CoreDNS, controllers, Karpenter, Kyverno) will go Pending until you wake system again. Learner node groups are untouched.',
      'Use when you want to cut system-node spend overnight but keep the API server. Prefer full eks-sleep only if you also intend to park labs pools.',
    ].join('\n\n'),
    argv: [path.join(EKS_ROOT, 'eks-sleep.sh')],
    env: { EKS_NODEGROUPS: 'system-k8s' },
  },
  'addon-placement': {
    label: 'Pin add-ons to system',
    section: 'control-plane',
    summary: 'Pin CoreDNS and controllers to system-k8s.',
    description: [
      'Updates EKS managed add-on configurationValues so Deployments land on system nodes (nodeSelector devlabs.io/pool=system): CoreDNS, metrics-server, snapshot-controller, and the EBS CSI controller.',
      'DaemonSets (aws-node / VPC CNI, kube-proxy, ebs-csi-node, pod-identity-agent) still run on every node — that is intentional.',
      'Prerequisite: at least one Ready system-k8s node. If you pin while Desired=0, CoreDNS stays Pending and the cluster has no DNS until system wakes. Idempotent; safe to re-run after recreate.',
    ].join('\n\n'),
    argv: [path.join(EKS_ROOT, 'eks-addon-placement.sh')],
  },
  kyverno: {
    label: 'Install Kyverno',
    section: 'control-plane',
    summary: 'Kyverno + learner do-not-disrupt policy.',
    description: [
      'Installs or upgrades Kyverno via Helm into the kyverno namespace, scheduled onto system-k8s (with the CriticalAddonsOnly toleration). Only the admission controller is enabled — background/cleanup/reports controllers stay off.',
      'Then applies the learner-do-not-disrupt MutatingPolicy: every Pod created in an ns-* namespace gets karpenter.sh/do-not-disrupt=true so Karpenter will not evict mid-lab pods during consolidation.',
      'With generateMutatingAdmissionPolicy enabled, Kyverno compiles that policy into a native MutatingAdmissionPolicy. After that, the API server enforces the annotation even if the Kyverno pod is down. Needs Helm, kubectl, and a Ready system node (Helm --wait).',
    ].join('\n\n'),
    argv: [path.join(EKS_ROOT, 'eks-kyverno.sh')],
  },
  admission: {
    label: 'Apply admission policies',
    section: 'control-plane',
    summary: 'Reject over-quota learner workloads at apply time.',
    description: [
      'Applies native ValidatingAdmissionPolicies (CEL, evaluated inside the API server — no webhook pod). They parameterize on each learner namespace’s dl-lab-quota ResourceQuota and dl-lab-limits LimitRange written by the backend on lab open.',
      'What gets rejected: Deployments / StatefulSets / scale / HPA replicas above the lab pod quota; pod templates (and CronJobs) with container requests/limits above the LimitRange max, or requests above limits. Namespaces without those objects are skipped.',
      'Why it exists: ResourceQuota only stops Pods. A Deployment that can never fit is otherwise accepted and then fails every ReplicaSet create with opaque errors. These policies fail fast at apply/scale time with a clear message. Needs kubectl only; no worker node required.',
    ].join('\n\n'),
    argv: [path.join(EKS_ROOT, 'eks-admission.sh')],
  },
  recreate: {
    label: 'Recreate cluster + system platform',
    section: 'control-plane',
    summary: 'Create/repair cluster; wake system; Kyverno + admission.',
    description: [
      'Primary bring-up / repair path after destroy or for a missing cluster. Idempotent: if the cluster already exists it will not delete it; it ensures node groups, add-ons, access, and kubeconfig are present.',
      'Creates managed NGs (system-k8s, labs-k8s, labs-linux, …) at Desired=0, ensures VPC CNI config (prefix delegation + network policy), EBS CSI Pod Identity, app Access Entry, and local (+ App EC2) kubeconfig. Then wakes system-k8s and runs addon-placement, Kyverno, and admission.',
      'Does not install Karpenter — run Install Karpenter separately afterward. Skip the wake/platform half with EKS_SKIP_PLATFORM=1 if you only want an empty control plane. Long-running; needs AWS admin + Helm + kubectl. Confirm by typing recreate.',
    ].join('\n\n'),
    argv: [path.join(EKS_ROOT, 'eks-recreate.sh')],
    confirm: 'recreate',
  },
  destroy: {
    label: 'Destroy cluster',
    section: 'control-plane',
    summary: 'Delete NGs and the EKS control plane.',
    description: [
      'Tears down the EKS cluster to stop control-plane billing. Order matters: balloons/NodePools (if any) and the Karpenter controller are removed first so orphaned Karpenter EC2 instances are not left behind, then managed node groups, then the cluster.',
      'Preserved across destroy (reused on recreate): App EC2, S3, IAM roles/users, learner homes on the App host, launch templates, and the Karpenter CloudFormation stack / subnet tags when present.',
      'Destructive. The dashboard asks you to type devlabs before it runs the script with --yes. Double-check you are on the intended account and region first.',
    ].join('\n\n'),
    argv: [path.join(EKS_ROOT, 'eks-destroy.sh'), '--yes'],
    confirm: 'devlabs',
  },
  karpenter: {
    label: 'Install Karpenter',
    section: 'karpenter',
    summary: 'Controller on system + labs-elastic NodePool.',
    description: [
      'Full Karpenter install for DevSetu. Deploys the upstream CloudFormation stack (node role, controller policies, interruption queue), Pod Identity for the controller ServiceAccount, an EC2_LINUX access entry so Karpenter-launched nodes can join, and discovery tags on subnets + the cluster security group.',
      'Helm-installs the Karpenter controller into kube-system on system-k8s (replicas=1, CriticalAddonsOnly toleration). Then applies the labs-elastic EC2NodeClass + NodePool used as overflow for Kubernetes labs on top of the labs-k8s managed base.',
      'Balloon warm-pool Deployments are intentionally not applied right now (and leftovers are removed). Prerequisite: Ready system-k8s (Helm --wait). For Linux overflow you still run Linux elastic (up) separately — that NodePool is different (labs-linux-elastic).',
    ].join('\n\n'),
    argv: [path.join(EKS_ROOT, 'eks-karpenter.sh')],
  },
  'karpenter-controller-only': {
    label: 'Karpenter controller only',
    section: 'karpenter',
    summary: 'Install controller without labs-elastic.',
    description: [
      'Same IAM / Helm / discovery path as Install Karpenter, but with EKS_KARPENTER_LABS_POOL=0 so labs-elastic and any labs balloons are skipped.',
      'Use this when the cluster only needs Karpenter for Linux (or Docker/Spark) elastic NodePools, or when labs-k8s is not in play and you do not want a labs-elastic pool buying nodes.',
      'You can still apply Linux elastic (up) afterward; that NodePool is independent. Needs a Ready system node for the controller.',
    ].join('\n\n'),
    argv: [path.join(EKS_ROOT, 'eks-karpenter.sh')],
    env: { EKS_KARPENTER_LABS_POOL: '0' },
  },
  'linux-base': {
    label: 'Linux base',
    section: 'linux',
    summary: 'labs-linux Desired=1 + NRI + seccomp.',
    description: [
      'Creates the labs-linux managed node group and launch template if missing, scales it to Desired=1, waits for a Ready node labeled pool=linux, then installs the NRI cgroup-rw plugin and box seccomp profiles.',
      'NRI is required so systemd can run as PID 1 inside user-namespaced Linux boxes. Seccomp profiles are required before boxes will start (CreateContainerError until the DaemonSet copies profiles onto the node). Both are DaemonSets selecting pool=linux, so future elastic nodes pick them up automatically.',
      'This is enough to operate Linux labs on a single always-on node. Optional overflow is Linux elastic (up). Needs AWS admin for the NG, kubectl/kubeconfig, and typically Karpenter only if you also plan to run up.',
    ].join('\n\n'),
    argv: [path.join(EKS_ROOT, 'eks-linux.sh'), 'base'],
  },
  'linux-up': {
    label: 'Linux elastic (up)',
    section: 'linux',
    summary: 'Apply labs-linux-elastic NodePool only.',
    description: [
      'Applies only the Karpenter EC2NodeClass + NodePool labs-linux-elastic. When Linux boxes are Pending because the managed base is full, Karpenter buys matching Graviton nodes (same pool label/taint as the base) and removes them once empty.',
      'Does not scale the managed NG and does not reinstall NRI/seccomp — run Linux base first for that. Elastic nodes inherit those DaemonSets via devlabs.io/pool=linux.',
      'Prerequisite: Karpenter controller already installed (Install Karpenter or controller-only). Cleans up legacy labs-linux NodePool / dl-linux-warm leftovers from older layouts.',
    ].join('\n\n'),
    argv: [path.join(EKS_ROOT, 'eks-linux.sh'), 'up'],
  },
  'linux-wake': {
    label: 'Linux wake',
    section: 'linux',
    summary: 'Wake labs-linux, plugins, and elastic.',
    description: [
      'Convenience path after Linux sleep: scales labs-linux back to 1, waits for Ready, re-applies NRI + seccomp, then runs the elastic NodePool apply (same as up).',
      'Use when Linux capacity was parked and you want both the always-on base and overflow restored in one action. If you only want the single managed node, prefer Linux base and skip up / wake’s elastic half.',
      'Needs AWS admin + kubectl; elastic restore needs Karpenter present.',
    ].join('\n\n'),
    argv: [path.join(EKS_ROOT, 'eks-linux.sh'), 'wake'],
  },
  'linux-sleep': {
    label: 'Linux sleep',
    section: 'linux',
    summary: 'Park elastic and labs-linux → 0.',
    description: [
      'Parks Linux capacity without touching system-k8s or the EKS control plane. First patches labs-linux-elastic cpu limit to 0 and deletes its NodeClaims (Karpenter terminates those EC2 instances), then scales the labs-linux managed group to Desired=0.',
      'NRI/seccomp DaemonSets remain in the cluster but have nowhere to run until Linux wakes again. Open Linux labs will sit Pending.',
      'Bring capacity back with Linux wake (base + elastic) or Linux base alone if you do not need overflow.',
    ].join('\n\n'),
    argv: [path.join(EKS_ROOT, 'eks-linux.sh'), 'sleep'],
  },
  'linux-spike': {
    label: 'Linux spike check',
    section: 'linux',
    summary: 'base + spike boxes + capability checks.',
    description: [
      'End-to-end capability probe for the Linux pool. Runs Linux base (NG + NRI + seccomp), applies deploy/eks/linux/spike.yaml, waits for spike pods Ready, then executes a battery of checks inside the box (user namespace, systemd, sudo, mounts, seccomp, and more).',
      'Use after infra changes (launch template, NRI image, seccomp profiles) to verify boxes still boot correctly before learners hit the pool.',
      'Requires the multi-arch devsetu/linux-lab image to be published (./images/build-all.sh linux-lab). First run may spend several minutes pulling the image.',
    ].join('\n\n'),
    argv: [path.join(EKS_ROOT, 'eks-linux.sh'), 'spike'],
  },
  'linux-down': {
    label: 'Linux down',
    section: 'linux',
    summary: 'Tear down spike, plugins, elastic; sleep NG.',
    description: [
      'Full Linux teardown for spike / infra experiments: deletes the spike namespace, removes NRI and seccomp DaemonSets (and the seccomp ConfigMap), deletes the labs-linux-elastic NodePool/EC2NodeClass, then sleeps labs-linux to Desired=0.',
      'After this, Linux labs will not work until you run Linux base again (and up if you want elastic). Stronger than sleep alone because plugins are removed from the cluster.',
      'Confirm by typing down. Prefer Linux sleep when you only want to park capacity and keep plugins installed.',
    ].join('\n\n'),
    argv: [path.join(EKS_ROOT, 'eks-linux.sh'), 'down'],
    confirm: 'down',
  },
};

/**
 * @typedef {{ id: string; action: string; status: string; startedAt: number; endedAt: number | null; log: string; exitCode: number | null }} Job
 */

/** @type {Job | null} */
let job = null;
/** Last finished (or in-flight) job per action id. */
/** @type {Record<string, Job>} */
const lastByAction = {};

function commandLine(a) {
  const envBits = Object.entries(a.env || {})
    .map(([k, v]) => `${k}=${v}`)
    .join(' ');
  const rel = a.argv
    .map((p, i) => (i === 0 ? `./deploy/eks/${path.basename(p)}` : p))
    .join(' ');
  return envBits ? `${envBits} ${rel}` : rel;
}

function scriptAbsPath(actionId) {
  const def = ACTIONS[actionId];
  if (!def) return null;
  return path.resolve(def.argv[0]);
}

function scriptRelPath(actionId) {
  const abs = scriptAbsPath(actionId);
  if (!abs) return null;
  return path.relative(REPO_ROOT, abs);
}

function readActionScript(actionId) {
  const abs = scriptAbsPath(actionId);
  if (!abs) {
    const err = new Error(`unknown action: ${actionId}`);
    err.status = 404;
    throw err;
  }
  const resolved = path.resolve(abs);
  if (!resolved.startsWith(EKS_ROOT + path.sep) && resolved !== EKS_ROOT) {
    const err = new Error('path not allowed');
    err.status = 403;
    throw err;
  }
  if (!fs.existsSync(resolved)) {
    const err = new Error(`file not found: ${resolved}`);
    err.status = 404;
    throw err;
  }
  return {
    action: actionId,
    path: scriptRelPath(actionId),
    absPath: resolved,
    content: fs.readFileSync(resolved, 'utf8'),
  };
}

function hasBin(cmd) {
  const r = spawnSync('which', [cmd], { encoding: 'utf8' });
  return r.status === 0 && Boolean((r.stdout || '').trim());
}

function openInEditor(actionId) {
  const file = readActionScript(actionId);
  /** @type {[string, string[]][]} */
  const candidates = [];
  if (hasBin('cursor')) candidates.push(['cursor', [file.absPath]]);
  if (hasBin('code')) candidates.push(['code', [file.absPath]]);
  if (process.platform === 'darwin') {
    candidates.push(['open', ['-a', 'Cursor', file.absPath]]);
  }

  for (const [cmd, args] of candidates) {
    const child = spawn(cmd, args, {
      cwd: REPO_ROOT,
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
    return { opened: true, via: cmd, path: file.path, absPath: file.absPath };
  }

  const err = new Error(
    'Could not open editor (tried cursor, code, open -a Cursor). Open the path manually.',
  );
  err.status = 500;
  err.path = file.path;
  err.absPath = file.absPath;
  throw err;
}

function catalog() {
  return Object.entries(ACTIONS).map(([id, a]) => ({
    id,
    label: a.label,
    section: a.section,
    description: a.description,
    summary: a.summary,
    command: commandLine(a),
    scriptPath: scriptRelPath(id),
    confirm: a.confirm || null,
  }));
}

function jobForAction(actionId) {
  if (job && job.action === actionId) return job;
  return lastByAction[actionId] || null;
}

function remember(j) {
  lastByAction[j.action] = j;
}

function startJob(actionId, confirm) {
  const def = ACTIONS[actionId];
  if (!def) {
    const err = new Error(`unknown action: ${actionId}`);
    err.status = 400;
    throw err;
  }
  if (job && job.status === 'running') {
    const err = new Error('another job is already running');
    err.status = 409;
    throw err;
  }
  if (def.confirm) {
    if (confirm !== def.confirm) {
      const err = new Error(`type "${def.confirm}" to confirm`);
      err.status = 400;
      throw err;
    }
  }

  const id = `${Date.now()}-${actionId}`;
  job = {
    id,
    action: actionId,
    status: 'running',
    startedAt: Date.now(),
    endedAt: null,
    log: '',
    exitCode: null,
  };
  remember(job);

  const env = {
    ...process.env,
    ...(def.env || {}),
    // Prefer repo kubeconfig unless caller already set one.
    KUBECONFIG:
      process.env.KUBECONFIG ||
      process.env.EKS_KUBECONFIG_OUT ||
      path.resolve(EKS_ROOT, '../../kube/k8s-lab.kubeconfig'),
  };

  const child = spawn(def.argv[0], def.argv.slice(1), {
    cwd: path.resolve(EKS_ROOT, '../..'),
    env,
    shell: false,
  });

  const append = (chunk) => {
    if (!job || job.id !== id) return;
    job.log += chunk.toString();
    if (job.log.length > 400_000) job.log = job.log.slice(-350_000);
    remember(job);
  };
  child.stdout.on('data', append);
  child.stderr.on('data', append);
  child.on('error', (e) => {
    if (!job || job.id !== id) return;
    job.log += `\n[spawn error] ${e.message}\n`;
    job.status = 'failed';
    job.exitCode = 1;
    job.endedAt = Date.now();
    remember(job);
  });
  child.on('close', (code) => {
    if (!job || job.id !== id) return;
    job.exitCode = code ?? 1;
    job.status = code === 0 ? 'ok' : 'failed';
    job.endedAt = Date.now();
    remember(job);
  });

  return { id, action: actionId };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(Object.assign(new Error('invalid JSON'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(data);
}

function contentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.js')) return 'text/javascript; charset=utf-8';
  return 'application/octet-stream';
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${HOST}:${PORT}`);

  try {
    if (req.method === 'GET' && url.pathname === '/api/catalog') {
      return sendJson(res, 200, {
        profile: process.env.AWS_PROFILE || null,
        region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-south-2',
        actions: catalog(),
      });
    }

    if (req.method === 'GET' && url.pathname === '/api/job') {
      const action = url.searchParams.get('action');
      if (action) {
        return sendJson(res, 200, { job: jobForAction(action) });
      }
      return sendJson(res, 200, {
        job,
        runningAction: job && job.status === 'running' ? job.action : null,
      });
    }

    if (req.method === 'POST' && url.pathname === '/api/run') {
      const body = await readBody(req);
      const result = startJob(String(body.action || ''), body.confirm);
      return sendJson(res, 202, result);
    }

    if (req.method === 'GET' && url.pathname === '/api/file') {
      const action = String(url.searchParams.get('action') || '');
      return sendJson(res, 200, readActionScript(action));
    }

    if (req.method === 'POST' && url.pathname === '/api/open-file') {
      const body = await readBody(req);
      try {
        return sendJson(res, 200, openInEditor(String(body.action || '')));
      } catch (e) {
        return sendJson(res, e.status || 500, {
          error: e.message || String(e),
          path: e.path || null,
          absPath: e.absPath || null,
        });
      }
    }

    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      const file = path.join(PUBLIC, 'index.html');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(fs.readFileSync(file));
    }

    if (req.method === 'GET' && url.pathname.startsWith('/static/')) {
      const file = path.join(PUBLIC, url.pathname.slice('/static/'.length));
      if (!file.startsWith(PUBLIC) || !fs.existsSync(file)) {
        res.writeHead(404);
        return res.end('not found');
      }
      res.writeHead(200, { 'Content-Type': contentType(file) });
      return res.end(fs.readFileSync(file));
    }

    res.writeHead(404);
    res.end('not found');
  } catch (e) {
    sendJson(res, e.status || 500, { error: e.message || String(e) });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`EKS ops dashboard  http://${HOST}:${PORT}`);
  console.log(`AWS_PROFILE=${process.env.AWS_PROFILE || '(default)'}  scripts=${EKS_ROOT}`);
});
