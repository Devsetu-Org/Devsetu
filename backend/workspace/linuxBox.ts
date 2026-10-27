'use strict';

/**
 * Box-lab learner machines: one pod `box` per learner, running systemd as PID 1 with a
 * sudo-capable `learner`. Two flavors (challenges/labTypes):
 *   linux  — namespace lx-<user>, images/linux-lab, labs-linux pool
 *   docker — namespace dk-<user>, images/docker-lab (linux-lab + dockerd), labs-docker
 *            pool; pulls images only through the in-cluster mirror (dl-mirror)
 *
 * The pod is user-namespaced (hostUsers: false), so root and the added capabilities
 * only apply inside it; the nri-cgroup-rw plugin on box nodes makes its cgroupfs
 * writable so systemd (and dockerd's per-container cgroups) work (deploy/eks/linux/,
 * deploy/eks/docker/). Linux boxes run devlabs/linux-box.json and Docker boxes run
 * devlabs/docker-box.json (the same denials, except keyrings and bpf, which runc needs).
 * The seccomp-profiles DaemonSets install them on labs-linux and labs-docker nodes.
 * Learners get no
 * Kubernetes API access here: the backend creates the pod and the terminal execs into it
 * with controller credentials.
 *
 * Sandboxes are ephemeral. Ending a lab deletes the pod and does not keep the
 * filesystem. A paid learner can save progress by hand while the lab is open;
 * the next open boots a new pod, runs setup.sh, then puts that save back.
 * Any archive left from the old automatic save path is deleted.
 *
 * No-root labs (platformSpec.box.unprivileged, the free shell/file-navigation set) skip
 * systemd and the added capabilities: a plain `sleep infinity` PID 1, RuntimeDefault
 * seccomp, and only the caps setup.sh and runuser->learner need. This keeps the kernel
 * attack surface of the untrusted free tier at the container-runtime baseline.
 */

import type { BoxFlavor, LinuxBoxSpec } from '../types/domain';

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const k8s = require('./k8sCluster');

const BOX_POD = 'box';
const BOX_CONTAINER = 'box';
const LEARNER_USER = 'learner';
/** Covers a cold start (~50 s: Karpenter node ~31 s + image pull ~9 s + systemd boot ~10 s). */
const READY_TIMEOUT_S = Math.max(60, Number(process.env.LINUX_LAB_READY_TIMEOUT_S || 300));
const MIRROR_NAMESPACE = 'dl-mirror';

type Flavor = {
  nsPrefix: string;
  component: string;
  /** devlabs.io/pool label and taint of the flavor's node pool. */
  pool: string;
  image: string;
  resources: {
    requests: { cpu: string; memory: string; ephemeral: string };
    limits: { cpu: string; memory: string; ephemeral: string };
  };
  tmpSize: string;
  docker: boolean;
  /** Container seccompProfile, as YAML lines under `seccompProfile:`. */
  seccomp: string;
};

/**
 * LINUX_LAB_SECCOMP=unconfined is the escape hatch if the profile breaks a lab or is not
 * installed on the nodes yet (boxes then fail with CreateContainerError).
 */
const LINUX_SECCOMP = process.env.LINUX_LAB_SECCOMP === 'unconfined'
  ? 'type: Unconfined'
  : 'type: Localhost\n          localhostProfile: devlabs/linux-box.json';

/** Same escape hatch for Docker boxes. See deploy/eks/docker/seccomp/docker-box.json. */
const DOCKER_SECCOMP = process.env.DOCKER_LAB_SECCOMP === 'unconfined'
  ? 'type: Unconfined'
  : 'type: Localhost\n          localhostProfile: devlabs/docker-box.json';

const FLAVORS: Record<BoxFlavor, Flavor> = {
  /**
   * Sized for ~40 boxes per t4g.medium (deploy/eks/karpenter/nodepool-linux.yaml). Lab 18
   * mounts a 64 Mi tmpfs and needs ~85 Mi unreclaimable, so keep the memory limit well above.
   * Without an explicit ephemeral request the scheduler reserves the whole limit per box.
   */
  linux: {
    nsPrefix: 'lx-',
    component: 'linux-lab',
    pool: 'linux',
    image: process.env.LINUX_LAB_IMAGE || 'devsetu/linux-lab:v0.5',
    resources: {
      requests: { cpu: '25m', memory: '64Mi', ephemeral: '256Mi' },
      limits: { cpu: '250m', memory: '256Mi', ephemeral: '2Gi' },
    },
    tmpSize: '512Mi',
    docker: false,
    seccomp: LINUX_SECCOMP,
  },
  /**
   * ~12 boxes per t4g.medium (deploy/eks/karpenter/nodepool-docker.yaml). An idle box uses
   * ~46 Mi and a solved lab at most ~232 Mi (three Python services); image pulls take ~1 core
   * for a few seconds. The ephemeral limit covers the 10Gi /var/lib/docker emptyDir.
   */
  docker: {
    nsPrefix: 'dk-',
    component: 'docker-lab',
    pool: 'docker',
    image: process.env.DOCKER_LAB_IMAGE || 'devsetu/docker-lab:v0.2',
    resources: {
      requests: { cpu: '100m', memory: '256Mi', ephemeral: '1Gi' },
      limits: { cpu: '1000m', memory: '512Mi', ephemeral: '12Gi' },
    },
    tmpSize: '1Gi',
    docker: true,
    seccomp: DOCKER_SECCOMP,
  },
};

/** lx-<user> / dk-<user>, same slug as the learner's Kubernetes namespace. */
function boxNamespace(userName: string, flavor: BoxFlavor): string {
  return String(k8s.learnerNamespace(userName)).replace(/^ns-/, FLAVORS[flavor].nsPrefix);
}

/** Blog playground box. Separate from lx-<user> so it never shares a lab's pod. */
function playgroundNamespace(userName: string): string {
  return String(k8s.learnerNamespace(userName)).replace(/^ns-/, 'lp-');
}

/**
 * Only the backend creates pods here, so the namespace runs the privileged Pod
 * Security level (the box adds capabilities and a custom seccomp profile). The
 * NetworkPolicy allows only same-namespace traffic and DNS (plus the registry mirror for
 * Docker boxes): no other boxes, VPC, instance metadata or public internet. Labs that need
 * the internet (apt) stay closed until boxes are hardened. It is enforced by the VPC CNI
 * network policy agent (enableNetworkPolicy in deploy/eks/env.sh).
 */
function namespaceYaml(ns: string, flavor: BoxFlavor): string {
  const f = FLAVORS[flavor];
  const mirrorLabel = f.docker ? '\n    devlabs.io/registry-mirror: client' : '';
  const mirrorEgress = f.docker
    ? `
    - to:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: ${MIRROR_NAMESPACE}
          podSelector:
            matchLabels:
              app: registry-mirror
      ports:
        - {protocol: TCP, port: 5000}`
    : '';
  return `
apiVersion: v1
kind: Namespace
metadata:
  name: ${ns}
  labels:
    app.kubernetes.io/managed-by: devlabs
    app.kubernetes.io/component: ${f.component}
    pod-security.kubernetes.io/enforce: privileged${mirrorLabel}
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
        - {protocol: TCP, port: 53}${mirrorEgress}
`;
}

function labelValue(raw: string): string {
  return raw.replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 63).replace(/[^A-Za-z0-9]+$/, '');
}

/**
 * The pod clock starts when the kubelet accepts the pod, so it includes image pull and boot.
 * The lab clock starts when the machine is handed over and runs out on its own.
 * Five extra minutes keep that full lab time, because this pod clock includes image pull and boot.
 * A start cancelled before the pod existed can still land afterwards; this stops that machine
 * even when the learner never opens another lab. Loaded lazily: sessionIdle pulls in this module.
 */
function boxActiveDeadlineSeconds(): number {
  const sessionIdle = require('./sessionIdle');
  return Math.ceil(Number(sessionIdle.IDLE_MS) / 1000) + 5 * 60;
}

function boxPodYaml(ns: string, challengeId: string, flavor: BoxFlavor, spec: LinuxBoxSpec = {}): string {
  const f = FLAVORS[flavor];
  // No-root labs (free shell/file-navigation set): plain machine, no systemd, no added
  // capabilities, RuntimeDefault seccomp. Only linux boxes; docker always needs root/dockerd.
  const unprivileged = flavor === 'linux' && spec.unprivileged === true;
  const res = {
    requests: { ...f.resources.requests, ...(spec.resources?.requests || {}) },
    limits: { ...f.resources.limits, ...(spec.resources?.limits || {}) },
  };
  // Ready = systemd finished booting ("degraded" still counts: a learner's broken unit
  // must not take the machine out of service); Docker boxes also wait for dockerd.
  const ready = 'case \\"$(systemctl is-system-running)\\" in running|degraded) ;; *) exit 1;; esac'
    + (f.docker ? '; systemctl is-active --quiet docker' : '');
  // procMount Unmasked (allowed only with hostUsers: false) leaves /proc/sys writable so
  // dockerd can set net.ipv4.ip_forward; net.* sysctls belong to the pod's own netns.
  // /var/lib/docker sits on an emptyDir: overlay2 cannot stack on the overlay rootfs.
  const procMount = f.docker ? '\n        procMount: Unmasked' : '';
  const dockerMount = f.docker ? '\n        - {name: docker, mountPath: /var/lib/docker}' : '';
  const dockerVolume = f.docker ? '\n    - name: docker\n      emptyDir: {sizeLimit: 10Gi}' : '';
  // The cgroup-rw NRI plugin only acts on this annotation, so no-root boxes (no systemd)
  // skip it and keep the read-only cgroupfs.
  const cgroupAnnotation = unprivileged ? '' : '\n    devlabs.io/cgroup-rw: "true"';
  // No-root box: drop the box's added powers (the SYS_ADMIN/NET_ADMIN escape surface) and
  // the custom seccomp exemptions; keep only the caps setup.sh and runuser->learner need.
  const securityContext = unprivileged
    ? `      securityContext:
        capabilities:
          drop: [ALL]
          add: [SETUID, SETGID, CHOWN, DAC_OVERRIDE, FOWNER, FSETID]
        seccompProfile:
          type: RuntimeDefault`
    : `      securityContext:${procMount}
        capabilities:
          add: [SYS_ADMIN, NET_ADMIN, NET_RAW, SYS_PTRACE, SYS_RESOURCE, SYS_NICE, AUDIT_WRITE]
        seccompProfile:
          ${f.seccomp}`;
  // Every box drops a .hushlogin so Ubuntu's /etc/bash.bashrc "use sudo" login hint never
  // shows (we don't want sudo/root chatter in the banner). No-root boxes have no systemd, so
  // PID 1 is a plain idle process (setup.sh execs in as root, the shell as learner); paid/
  // Docker boxes exec systemd as PID 1 (exec keeps it PID 1; image STOPSIGNAL still applies).
  const initCmd = unprivileged ? 'sleep infinity' : '/sbin/init';
  const command = `\n      command: ["/bin/sh", "-c", "touch /home/learner/.hushlogin 2>/dev/null; exec ${initCmd}"]`;
  const readinessProbe = unprivileged
    ? ''
    : `
      readinessProbe:
        exec:
          command: ["/bin/sh", "-c", "${ready}"]
        periodSeconds: 2
        timeoutSeconds: 5
        failureThreshold: 3`;
  return `
apiVersion: v1
kind: Pod
metadata:
  name: ${BOX_POD}
  namespace: ${ns}
  labels:
    app.kubernetes.io/managed-by: devlabs
    app: ${flavor}-box
    ${k8s.CHALLENGE_LABEL}: ${labelValue(challengeId)}
  annotations:
    karpenter.sh/do-not-disrupt: "true"${cgroupAnnotation}
spec:
  hostUsers: false
  hostname: ${spec.hostname || 'order-box'}
  automountServiceAccountToken: false
  enableServiceLinks: false
  terminationGracePeriodSeconds: ${f.docker ? 20 : 10}
  activeDeadlineSeconds: ${boxActiveDeadlineSeconds()}
  nodeSelector:
    devlabs.io/pool: ${f.pool}
  # Fill the always-on base first: boxes are do-not-disrupt, so a box placed on an elastic
  # node keeps that node alive until the box ends.
  affinity:
    nodeAffinity:
      preferredDuringSchedulingIgnoredDuringExecution:
        - weight: 100
          preference:
            matchExpressions:
              - {key: devlabs.io/tier, operator: In, values: [base]}
  tolerations:
    - key: devlabs.io/pool
      value: ${f.pool}
      effect: NoSchedule
  containers:
    - name: ${BOX_CONTAINER}
      image: ${spec.image || f.image}${command}
${securityContext}${readinessProbe}
      resources:
        requests: {cpu: "${res.requests.cpu}", memory: "${res.requests.memory}", ephemeral-storage: ${f.resources.requests.ephemeral}}
        limits: {cpu: "${res.limits.cpu}", memory: "${res.limits.memory}", ephemeral-storage: ${f.resources.limits.ephemeral}}
      volumeMounts:
        - {name: run, mountPath: /run}
        - {name: run-lock, mountPath: /run/lock}
        - {name: tmp, mountPath: /tmp}${dockerMount}
  volumes:
    - name: run
      emptyDir: {medium: Memory, sizeLimit: 64Mi}
    - name: run-lock
      emptyDir: {medium: Memory, sizeLimit: 8Mi}
    - name: tmp
      emptyDir: {sizeLimit: ${f.tmpSize}}${dockerVolume}
`;
}

const ensuredNamespaces = new Set<string>();

async function ensureNamespace(ns: string, flavor: BoxFlavor): Promise<void> {
  if (ensuredNamespaces.has(ns)) return;
  await k8s.kubectlOk(['apply', '-f', '-'], { input: namespaceYaml(ns, flavor), timeoutMs: 30_000 });
  ensuredNamespaces.add(ns);
}

/** Why the box is not Ready, for logs (image pull, unschedulable, crash). */
async function describeNotReady(ns: string): Promise<string> {
  const r = await k8s.runKubectl(
    ['get', 'pod', BOX_POD, '-n', ns, '-o',
      'jsonpath={.status.phase} {.status.conditions[?(@.type=="PodScheduled")].message} {.status.containerStatuses[0].state}'],
    { timeoutMs: 15_000 },
  );
  return (r.stdout || r.stderr || '').trim();
}

/**
 * Boxes are disposable, so they get a 1 s grace period: an open terminal's shell is
 * outside systemd's control and would otherwise hold every delete for the full
 * terminationGracePeriodSeconds.
 */
const DELETE_GRACE_S = '1';

/** Delete any previous box and start a fresh one; resolves once systemd (and dockerd) are up. */
async function recreateBox(
  ns: string,
  challengeId: string,
  flavor: BoxFlavor,
  spec?: LinuxBoxSpec,
  onPhase?: (message: string) => void,
): Promise<void> {
  onPhase?.('Creating your machine');
  await ensureNamespace(ns, flavor);
  await k8s.kubectlOk(
    ['delete', 'pod', BOX_POD, '-n', ns, '--ignore-not-found', `--grace-period=${DELETE_GRACE_S}`,
      '--wait=true', '--timeout=60s'],
    { timeoutMs: 75_000 },
  );
  await k8s.kubectlOk(['apply', '-f', '-'], {
    input: boxPodYaml(ns, challengeId, flavor, spec),
    timeoutMs: 30_000,
  });
  onPhase?.('Waiting for your machine to start');
  const ready = await k8s.runKubectl(
    ['wait', '--for=condition=Ready', `pod/${BOX_POD}`, '-n', ns, `--timeout=${READY_TIMEOUT_S}s`],
    { timeoutMs: (READY_TIMEOUT_S + 15) * 1000 },
  );
  if (ready.code !== 0) {
    throw new Error(`box not ready after ${READY_TIMEOUT_S}s: ${await describeNotReady(ns)}`);
  }
}

async function deleteBox(ns: string): Promise<void> {
  await k8s.kubectlOk(
    ['delete', 'pod', BOX_POD, '-n', ns, '--ignore-not-found', `--grace-period=${DELETE_GRACE_S}`,
      '--wait=false'],
    { timeoutMs: 30_000 },
  );
}

/** Old filesystem archives lived next to namespace snapshots. Delete them; nothing new is written. */
const WORK_ROOT =
  String(process.env.K8S_LAB_SNAPSHOT_ROOT || '').trim()
  || path.join(os.homedir(), '.devlabs', 'k8s-snapshots');

function workArchivePath(ns: string, challengeId: string): string {
  const safeNs = ns.replace(/[^a-z0-9-]/g, '_');
  const safeId = (challengeId || 'unknown').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
  return path.join(WORK_ROOT, safeNs, `${safeId}.box.tar`);
}

function discardBoxWork(ns: string, challengeId: string): void {
  const dest = workArchivePath(ns, challengeId);
  fs.rmSync(dest, { force: true });
  fs.rmSync(`${dest}.partial`, { force: true });
}

/**
 * Manual save for a paid learner. One archive per lab, overwritten each time,
 * counted against 500 MB for the whole account. The archive is an allowlist
 * (home, etc, srv, opt, usr/local, var/spool, root) with ACLs, plus the apt
 * packages they installed. It is not the whole machine.
 */
const PROGRESS_LIMIT_BYTES = 500 * 1024 * 1024;
const PROGRESS_IO_MS = 10 * 60 * 1000;
const PROGRESS_DIR = path.join(WORK_ROOT, 'progress');

const SAVE_SCRIPT = `
set -eu
list=""
for p in home etc srv opt usr/local var/spool root; do
  if [ -e "/$p" ]; then list="$list $p"; fi
done
if [ -z "$list" ]; then echo "nothing on the machine to save" >&2; exit 2; fi
exec tar -C / -cf - --acls --xattrs --warning=no-file-changed \
  --exclude=etc/hostname --exclude=etc/hosts --exclude=etc/resolv.conf --exclude=etc/mtab \
  $list
`;

const MISSING_PKGS_SCRIPT = `
while IFS= read -r p; do
  case "$p" in
    ""|*[!a-z0-9.+-]*) continue ;;
  esac
  dpkg -s "$p" >/dev/null 2>&1 || printf '%s\\n' "$p"
done
`;

const INSTALL_PKGS_SCRIPT = `
missing=""
while IFS= read -r p; do
  case "$p" in
    ""|*[!a-z0-9.+-]*) continue ;;
  esac
  missing="$missing $p"
done
if [ -n "$missing" ]; then
  apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y -o Dpkg::Options::=--force-confold $missing
fi
`;

class ProgressError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ProgressError';
    this.status = status;
    this.code = code;
  }
}

type ProgressStatus = {
  saved: boolean;
  bytes: number;
  usedBytes: number;
  limitBytes: number;
};

function progressOwner(owner: string): string {
  const safe = String(owner || '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
  if (!safe || safe === 'anonymous') {
    throw new ProgressError(400, 'PROGRESS_OWNER', 'Could not tell which account this save belongs to.');
  }
  return safe;
}

function progressChallenge(challengeId: string): string {
  return String(challengeId || 'unknown').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
}

function progressDir(owner: string): string {
  return path.join(PROGRESS_DIR, progressOwner(owner));
}

function progressFiles(owner: string, challengeId: string): { tar: string; pkgs: string; partial: string } {
  const id = progressChallenge(challengeId);
  const dir = progressDir(owner);
  return {
    tar: path.join(dir, `${id}.tar`),
    pkgs: path.join(dir, `${id}.pkgs`),
    partial: path.join(dir, `${id}.tar.partial`),
  };
}

function fileSize(file: string): number {
  try {
    return fs.statSync(file).size;
  } catch {
    return 0;
  }
}

/** Bytes already saved for this account. Pass a challenge id to leave that lab out. */
function usedProgressBytes(owner: string, exceptChallengeId?: string): number {
  let dir: string;
  try {
    dir = progressDir(owner);
  } catch {
    return 0;
  }
  if (!fs.existsSync(dir)) return 0;
  const except = exceptChallengeId ? progressChallenge(exceptChallengeId) : null;
  let total = 0;
  for (const name of fs.readdirSync(dir) as string[]) {
    if (!name.endsWith('.tar') && !name.endsWith('.pkgs')) continue;
    const id = name.replace(/\.(tar|pkgs)$/, '');
    if (except && id === except) continue;
    total += fileSize(path.join(dir, name));
  }
  return total;
}

function formatProgressBytes(n: number): string {
  if (n >= 1024 * 1024 * 1024) return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (n >= 1024 * 1024) return `${Math.round(n / (1024 * 1024))} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

function quotaMessage(used: number): string {
  return `Saved progress is limited to 500 MB across all your labs. ${formatProgressBytes(used)} is already in use, so this save does not fit.`;
}

function progressStatus(owner: string, challengeId: string): ProgressStatus {
  const files = progressFiles(owner, challengeId);
  const tarBytes = fileSize(files.tar);
  const saved = tarBytes > 0;
  return {
    saved,
    bytes: saved ? tarBytes + fileSize(files.pkgs) : 0,
    usedBytes: usedProgressBytes(owner),
    limitBytes: PROGRESS_LIMIT_BYTES,
  };
}

function discardProgress(owner: string, challengeId: string): void {
  if (!owner) return;
  let files: { tar: string; pkgs: string; partial: string };
  try {
    files = progressFiles(owner, challengeId);
  } catch {
    return;
  }
  fs.rmSync(files.tar, { force: true });
  fs.rmSync(files.pkgs, { force: true });
  fs.rmSync(files.partial, { force: true });
}

function packageNames(text: string): string[] {
  const out: string[] = [];
  for (const line of String(text || '').split('\n')) {
    const name = line.trim();
    if (!/^[a-z0-9][a-z0-9.+-]*$/.test(name)) continue;
    if (!out.includes(name)) out.push(name);
    if (out.length >= 500) break;
  }
  return out;
}

type TarStreamOpts = {
  args: string[];
  stdinPath?: string;
  stdoutPath?: string;
  limitBytes?: number;
  /** Bytes already saved in other labs, for the quota error. */
  quotaUsed?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
};

/** Stream a tar between a file and `kubectl exec` without holding it in memory. */
function streamKubectl(opts: TarStreamOpts): Promise<{ code: number; bytes: number; stderr: string }> {
  const startSignal: AbortSignal | undefined = k8s.currentStartSignal();
  return new Promise((resolve, reject) => {
    let settled = false;
    let bytes = 0;
    let stderr = '';
    let quotaHit = false;
    let child: ReturnType<typeof spawn> | null = null;
    let out: ReturnType<typeof fs.createWriteStream> | null = null;
    const stopWatching = (): void => {
      clearTimeout(timer);
      opts.signal?.removeEventListener('abort', onAbort);
      startSignal?.removeEventListener('abort', onStartAbort);
    };
    const fail = (err: Error): void => {
      if (settled) return;
      settled = true;
      stopWatching();
      out?.destroy();
      reject(err);
    };
    const timer = setTimeout(() => {
      child?.kill('SIGKILL');
      fail(new ProgressError(504, 'PROGRESS_TIMEOUT', 'Saving or restoring progress took too long.'));
    }, opts.timeoutMs || PROGRESS_IO_MS);
    const onAbort = (): void => {
      child?.kill('SIGKILL');
      fail(new ProgressError(499, 'PROGRESS_CANCELLED', 'Save cancelled.'));
    };
    const onStartAbort = (): void => {
      child?.kill('SIGKILL');
      fail(k8s.startSuperseded());
    };
    if (opts.signal?.aborted || startSignal?.aborted) {
      (startSignal?.aborted ? onStartAbort : onAbort)();
      return;
    }
    opts.signal?.addEventListener('abort', onAbort, { once: true });
    startSignal?.addEventListener('abort', onStartAbort, { once: true });

    void k8s.controllerKubectlCommand(opts.args).then(
      (cmd: { args: string[]; env: NodeJS.ProcessEnv }) => {
        if (settled) return;
        child = spawn('kubectl', cmd.args, { env: cmd.env, stdio: ['pipe', 'pipe', 'pipe'] });
        out = opts.stdoutPath ? fs.createWriteStream(opts.stdoutPath) : null;
        out?.on('error', (err: Error) => fail(err));
        child.stderr?.on('data', (chunk: Buffer) => {
          if (stderr.length < 4000) stderr += chunk.toString('utf8');
        });
        child.stdout?.on('data', (chunk: Buffer) => {
          bytes += chunk.length;
          if (opts.limitBytes != null && bytes > opts.limitBytes) {
            quotaHit = true;
            child?.kill('SIGKILL');
            return;
          }
          if (out && !out.write(chunk)) child?.stdout?.pause();
        });
        if (out) out.on('drain', () => child?.stdout?.resume());
        child.on('error', (err: Error) => fail(err));
        child.on('close', (code: number | null) => {
          const finish = (): void => {
            if (settled) return;
            settled = true;
            stopWatching();
            if (startSignal?.aborted) {
              reject(k8s.startSuperseded());
              return;
            }
            if (quotaHit) {
              reject(new ProgressError(413, 'PROGRESS_QUOTA', quotaMessage(opts.quotaUsed || 0)));
              return;
            }
            resolve({ code: code ?? 1, bytes, stderr: stderr.trim() });
          };
          if (out) out.end(finish);
          else finish();
        });
        if (opts.stdinPath) {
          fs.createReadStream(opts.stdinPath)
            .on('error', (err: Error) => fail(err))
            .pipe(child.stdin);
        } else {
          child.stdin.end();
        }
      },
      (err: Error) => fail(err),
    );
  });
}

async function saveProgress(
  ns: string,
  owner: string,
  challengeId: string,
  signal?: AbortSignal,
): Promise<ProgressStatus> {
  const files = progressFiles(owner, challengeId);
  fs.mkdirSync(path.dirname(files.partial), { recursive: true, mode: 0o700 });
  try { fs.chmodSync(path.dirname(files.partial), 0o700); } catch { /* directory already private */ }
  fs.rmSync(files.partial, { force: true });
  const usedOther = usedProgressBytes(owner, challengeId);
  const room = PROGRESS_LIMIT_BYTES - usedOther - 65_536;
  if (room <= 0) {
    throw new ProgressError(413, 'PROGRESS_QUOTA', quotaMessage(usedOther));
  }
  let streamed: { code: number; bytes: number; stderr: string };
  try {
    streamed = await streamKubectl({
      args: ['exec', '-n', ns, BOX_POD, '-c', BOX_CONTAINER, '--', 'bash', '--noprofile', '--norc', '-c', SAVE_SCRIPT],
      stdoutPath: files.partial,
      limitBytes: room,
      quotaUsed: usedOther,
      signal,
    });
  } catch (err) {
    fs.rmSync(files.partial, { force: true });
    throw err;
  }
  if (streamed.code !== 0 && streamed.code !== 1) {
    fs.rmSync(files.partial, { force: true });
    const detail = streamed.stderr || `tar exited ${streamed.code}`;
    throw new ProgressError(502, 'PROGRESS_SAVE_FAILED', `Could not save progress. ${detail}`);
  }
  if (streamed.bytes <= 0 || fileSize(files.partial) <= 0) {
    fs.rmSync(files.partial, { force: true });
    throw new ProgressError(502, 'PROGRESS_SAVE_FAILED', 'Could not save progress. The archive was empty.');
  }
  fs.renameSync(files.partial, files.tar);
  try { fs.chmodSync(files.tar, 0o600); } catch { /* the archive is still the save */ }

  let pkgs = '';
  try {
    const listed = await k8s.runKubectl(
      ['exec', '-n', ns, BOX_POD, '-c', BOX_CONTAINER, '--', 'apt-mark', 'showmanual'],
      { timeoutMs: 20_000 },
    );
    if (listed.code === 0) pkgs = `${packageNames(listed.stdout).join('\n')}\n`;
  } catch {
    pkgs = '';
  }
  if (pkgs.trim()) fs.writeFileSync(files.pkgs, pkgs, { mode: 0o600 });
  else fs.rmSync(files.pkgs, { force: true });

  const status = progressStatus(owner, challengeId);
  if (status.usedBytes > PROGRESS_LIMIT_BYTES) {
    discardProgress(owner, challengeId);
    throw new ProgressError(413, 'PROGRESS_QUOTA', quotaMessage(usedProgressBytes(owner)));
  }
  return status;
}

async function execInBox(ns: string, script: string, input: string): Promise<{ code: number; stdout: string; stderr: string }> {
  return k8s.runKubectl(
    ['exec', '-i', '-n', ns, BOX_POD, '-c', BOX_CONTAINER, '--', 'bash', '--noprofile', '--norc', '-c', script],
    { input, timeoutMs: PROGRESS_IO_MS },
  );
}

/** Files the container runtime owns. Replacing them on restore fails with "File exists". */
const CONTAINER_ETC = ['etc/hostname', 'etc/hosts', 'etc/resolv.conf', 'etc/mtab'];

function containerFileNoise(stderr: string): boolean {
  const lines = stderr.split('\n').map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return false;
  return lines.every((line) => (
    /tar: etc\/(hostname|hosts|resolv\.conf|mtab):/.test(line)
    || /tar: Exiting with failure status/.test(line)
    || /command terminated with exit code/.test(line)
  ));
}

/**
 * Put a saved archive back after setup.sh. Setup often deletes lab paths, so
 * the save has to land on top of that starter state. Returns false when this
 * lab has no save.
 */
async function restoreProgress(
  ns: string,
  owner: string,
  challengeId: string,
  onPhase?: (message: string) => void,
): Promise<boolean> {
  let files: { tar: string; pkgs: string; partial: string };
  try {
    files = progressFiles(owner, challengeId);
  } catch {
    return false;
  }
  if (fileSize(files.tar) <= 0) return false;
  onPhase?.('Applying your saved progress');
  const extracted = await streamKubectl({
    args: [
      'exec', '-i', '-n', ns, BOX_POD, '-c', BOX_CONTAINER, '--',
      'tar', '-C', '/', '-xf', '-', '--acls', '--xattrs',
      ...CONTAINER_ETC.flatMap((rel) => ['--exclude', rel]),
    ],
    stdinPath: files.tar,
  });
  if (extracted.code !== 0 && extracted.code !== 1 && !containerFileNoise(extracted.stderr)) {
    throw new ProgressError(
      502,
      'PROGRESS_RESTORE_FAILED',
      `Your saved progress could not be applied. ${extracted.stderr || 'The archive could not be read.'}`,
    );
  }
  const names = packageNames(fs.existsSync(files.pkgs) ? fs.readFileSync(files.pkgs, 'utf8') : '');
  if (!names.length) return true;
  const probe = await execInBox(ns, MISSING_PKGS_SCRIPT, `${names.join('\n')}\n`);
  const missing = packageNames(probe.stdout);
  if (!missing.length) return true;
  onPhase?.('Installing tools from your saved progress');
  const installed = await execInBox(ns, INSTALL_PKGS_SCRIPT, `${missing.join('\n')}\n`);
  if (installed.code !== 0) {
    const detail = (installed.stderr || installed.stdout || 'apt failed').trim().split('\n').slice(-3).join(' ');
    throw new ProgressError(
      502,
      'PROGRESS_RESTORE_FAILED',
      `Your saved files are back, but tools from that save could not be installed. ${detail}`,
    );
  }
  return true;
}

/** devlabs.io/pool the flavor's boxes are scheduled on. */
function poolFor(flavor: BoxFlavor): string {
  return FLAVORS[flavor].pool;
}

/** Env for setup.sh / grade.sh (see backend/challenges/linux/_lib/lab.sh). */
function scriptEnv(): Record<string, string> {
  return { BOX_POD, BOX_CONTAINER };
}

/**
 * kubectl argv for an interactive login shell as the learner inside the box. Wrapped in a
 * respawn loop so `exit` drops the learner into a fresh login shell instead of ending the
 * exec and stranding the terminal (the frontend doesn't auto-reopen a closed shell). After
 * each exit we overwrite bash's built-in "logout" line with a friendlier note: the login
 * shell is SHLVL 2 (the wrapper is 1), so ~/.bash_logout's clear_console is skipped and the
 * only thing printed is that one "logout" line, which the cursor-up + clear replaces. The
 * loop ends when the pod is deleted or the exec is torn down (TTY SIGHUP). `sleep 1` guards
 * against a hot loop if runuser ever fails to start.
 */
const EXIT_NOTICE = 'This machine stays — Submit to solve the lab. Here is a fresh shell.';

function shellExecArgs(ns: string, exitNotice?: string): string[] {
  const notice = String(exitNotice || EXIT_NOTICE).replace(/'/g, '');
  const relaunch =
    `while :; do if runuser -l ${LEARNER_USER}; then `
    + `printf '\\033[A\\033[2K\\r\\033[38;5;179m${notice}\\033[0m\\n'; `
    + `else sleep 1; fi; done`;
  return ['exec', '-it', '-n', ns, BOX_POD, '-c', BOX_CONTAINER, '--', 'bash', '-c', relaunch];
}

/** Editor files for the blog playground. Only ~/playground/<simple name>. */
const PLAYGROUND_FILE_RE = /^playground\/[A-Za-z0-9_-][A-Za-z0-9._-]{0,80}$/;
const MAX_PLAYGROUND_FILE_BYTES = 256 * 1024;

class PlaygroundFileError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function playgroundFilePath(raw: unknown): string {
  if (typeof raw !== 'string' || !PLAYGROUND_FILE_RE.test(raw)) {
    throw new PlaygroundFileError(400, 'Save files under playground/, with a simple file name.');
  }
  return raw;
}

/** kubectl exec as the learner. $1 is the validated relative path, never interpolated. */
function learnerFileArgs(ns: string, relPath: string, script: string): string[] {
  return [
    'exec', '-i', '-n', ns, BOX_POD, '-c', BOX_CONTAINER, '--',
    'runuser', '-u', LEARNER_USER, '--',
    'bash', '-c', script, 'bash', relPath,
  ];
}

async function readLearnerFile(ns: string, rawPath: unknown): Promise<{ path: string; content: string }> {
  const relPath = playgroundFilePath(rawPath);
  const result = await k8s.runKubectl(
    learnerFileArgs(ns, relPath, 'cat "$HOME/$1"'),
    { timeoutMs: 20_000 },
  );
  if (result.code !== 0) {
    if (/No such file/.test(String(result.stderr || ''))) {
      throw new PlaygroundFileError(404, 'file not found');
    }
    throw new PlaygroundFileError(502, 'Could not read that file from the playground.');
  }
  return { path: relPath, content: String(result.stdout || '') };
}

async function writeLearnerFile(
  ns: string,
  rawPath: unknown,
  content: unknown,
): Promise<{ path: string }> {
  const relPath = playgroundFilePath(rawPath);
  if (typeof content !== 'string') throw new PlaygroundFileError(400, 'content must be text');
  if (Buffer.byteLength(content, 'utf8') > MAX_PLAYGROUND_FILE_BYTES) {
    throw new PlaygroundFileError(400, 'That file is too large to save (256 KB max).');
  }
  const result = await k8s.runKubectl(
    learnerFileArgs(
      ns,
      relPath,
      'install -d -m 755 "$HOME/playground" && cat > "$HOME/$1"',
    ),
    { input: content, timeoutMs: 20_000 },
  );
  if (result.code !== 0) {
    throw new PlaygroundFileError(502, 'Could not save that file on the playground.');
  }
  return { path: relPath };
}

module.exports = {
  BOX_POD,
  LEARNER_USER,
  boxNamespace,
  playgroundNamespace,
  recreateBox,
  deleteBox,
  discardBoxWork,
  PROGRESS_LIMIT_BYTES,
  progressStatus,
  discardProgress,
  saveProgress,
  restoreProgress,
  poolFor,
  scriptEnv,
  shellExecArgs,
  PlaygroundFileError,
  readLearnerFile,
  writeLearnerFile,
};
