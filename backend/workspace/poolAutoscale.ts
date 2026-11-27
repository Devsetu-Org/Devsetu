'use strict';

/**
 * Auto wake / sleep for lab node pools.
 *
 * - Linux (elastic_only): unpark Karpenter NodePool limits.cpu; Pending boxes buy nodes.
 * - Other tracks (base_plus_elastic): scale managed NG desired 0↔1 + restore elastic limits.
 * - Sleep after POOL_IDLE_GRACE_MS (default 15m) with no learner workloads.
 * - Never touches system-k8s.
 */

import * as path from 'path';
import * as fs from 'fs';

type LabPoolDef = {
  pool: string;
  mode: 'elastic_only' | 'base_plus_elastic' | 'always_on';
  nodegroup: string | null;
  elasticNodePool: string | null;
  elasticCpuLimit: string | null;
  maxNodes: number;
  nodepoolManifest: string | null;
  plugins: string[];
};

const {
  getPool,
  allSleepablePools,
} = require('./labPools') as {
  getPool: (pool: string | null | undefined) => LabPoolDef | null;
  allSleepablePools: () => LabPoolDef[];
};
const capacity = require('./k8sCapacity');
const k8s = require('./k8sCluster');
const sessionStore = require('../db/sessionStore');
const loader = require('../challenges/loader');
const { isBoxLabType } = require('../challenges/labTypes');

/**
 * Temporary hardcoded lean-launch defaults (no App EC2 .env required).
 * Override later with env; set POOL_AUTOSCALE=0 to disable.
 */
const AUTOSCALE = () => process.env.POOL_AUTOSCALE !== '0';
const GRACE_MS = () => Math.max(60_000, Number(process.env.POOL_IDLE_GRACE_MS || 900_000)); // 15m
const WAKE_TIMEOUT_MS = () => Math.max(60_000, Number(process.env.POOL_WAKE_TIMEOUT_MS || 600_000)); // 10m
const SWEEP_MS = () => Math.max(15_000, Number(process.env.POOL_IDLE_SWEEP_MS || 60_000));

const wakeInflight = new Map<string, Promise<void>>();
const waking = new Set<string>();
const emptySince = new Map<string, number>();
let sweepTimer: ReturnType<typeof setInterval> | null = null;

const APP_EC2_DEPLOY_ROOTS = [
  '/opt/devlabs/deploy/eks',
  '/opt/devlabs/app/deploy/eks',
  '/home/ec2-user/Devlabs/deploy/eks',
];

function deployRoot(): string {
  if (process.env.EKS_DEPLOY_ROOT) return process.env.EKS_DEPLOY_ROOT;
  for (const candidate of APP_EC2_DEPLOY_ROOTS) {
    if (fs.existsSync(candidate)) return candidate;
  }
  // backend/ → repo root → deploy/eks (local checkout / release bundle)
  return path.resolve(__dirname, '..', '..', 'deploy', 'eks');
}

function manifestPath(rel: string | null): string | null {
  if (!rel) return null;
  return path.join(deployRoot(), rel);
}

async function kubectlJson<T>(args: string[]): Promise<T> {
  const out = await k8s.kubectlOk([...args, '-o', 'json'], { timeoutMs: 30_000 });
  return JSON.parse(out) as T;
}

let karpenterApiCache: { at: number; ok: boolean } | null = null;

/** False when Karpenter CRDs are missing (elastic NodePools cannot be used). */
async function karpenterInstalled(): Promise<boolean> {
  if (karpenterApiCache && Date.now() - karpenterApiCache.at < 60_000) {
    return karpenterApiCache.ok;
  }
  let ok = false;
  try {
    await k8s.kubectlOk(['get', 'crd', 'nodepools.karpenter.sh'], { timeoutMs: 10_000 });
    ok = true;
  } catch {
    ok = false;
  }
  karpenterApiCache = { at: Date.now(), ok };
  return ok;
}

async function nodepoolCpuLimit(name: string): Promise<number | null> {
  if (!(await karpenterInstalled())) return null;
  try {
    const np = await kubectlJson<{
      spec?: { limits?: { cpu?: string | number } };
      metadata?: { deletionTimestamp?: string };
    }>(['get', 'nodepool', name]);
    if (np.metadata?.deletionTimestamp) return null;
    const raw = np.spec?.limits?.cpu;
    if (raw == null) return 0;
    return Number(String(raw).replace(/[^0-9.]/g, '')) || 0;
  } catch {
    return null;
  }
}

/** True when the pool can accept new work (nodes may still be cold for elastic_only). */
async function poolCapacityReady(pool: string): Promise<boolean> {
  const def = getPool(pool);
  if (!def || def.mode === 'always_on') return capacity.poolUp(pool);

  // Any Ready node for this pool counts (managed base or Karpenter).
  if (await capacity.poolUp(pool)) return true;

  if (def.mode === 'elastic_only') {
    if (!def.elasticNodePool) return false;
    if (!(await karpenterInstalled())) return false;
    const cpu = await nodepoolCpuLimit(def.elasticNodePool);
    return cpu != null && cpu > 0;
  }

  return false;
}

function isWaking(pool: string): boolean {
  return waking.has(pool);
}

async function applyManifest(rel: string): Promise<void> {
  const full = manifestPath(rel);
  if (!full || !fs.existsSync(full)) {
    throw new Error(`nodepool manifest missing: ${full || rel} (set EKS_DEPLOY_ROOT)`);
  }
  await k8s.kubectlOk(['apply', '-f', full], { timeoutMs: 120_000 });
}

async function ensurePlugins(def: LabPoolDef): Promise<void> {
  const root = deployRoot();
  for (const p of def.plugins) {
    try {
      if (p === 'nri-linux') {
        await k8s.kubectlOk(['apply', '-f', path.join(root, 'linux', 'nri-cgroup-rw.yaml')], { timeoutMs: 60_000 });
      } else if (p === 'seccomp-linux') {
        await k8s.kubectlOk(['apply', '-f', path.join(root, 'linux', 'seccomp-profiles.yaml')], { timeoutMs: 60_000 });
        const seccompDir = path.join(root, 'linux', 'seccomp');
        if (fs.existsSync(seccompDir)) {
          // ConfigMap from files — best-effort; ops scripts own the full path.
          await k8s.kubectlOk(
            ['-n', 'dl-system', 'create', 'configmap', 'seccomp-profiles', `--from-file=${seccompDir}`, '--dry-run=client', '-o', 'yaml'],
            { timeoutMs: 30_000 },
          ).then(async (yaml: string) => {
            await k8s.kubectlOk(['apply', '-f', '-'], { timeoutMs: 30_000, input: yaml });
          }).catch(() => undefined);
        }
      } else if (p === 'nri-docker') {
        await k8s.kubectlOk(['apply', '-f', path.join(root, 'docker', 'nri-cgroup-rw.yaml')], { timeoutMs: 60_000 });
      } else if (p === 'seccomp-docker') {
        await k8s.kubectlOk(['apply', '-f', path.join(root, 'docker', 'seccomp-profiles.yaml')], { timeoutMs: 60_000 });
      } else if (p === 'mirror-docker') {
        const mirror = path.join(root, 'docker', 'registry-mirror.yaml');
        if (fs.existsSync(mirror)) {
          await k8s.kubectlOk(['apply', '-f', mirror], { timeoutMs: 60_000 });
        }
      }
    } catch (err) {
      console.warn(
        `[pool-autoscale] plugin ${p} for ${def.pool}: ${(err as Error).message || err}`,
      );
    }
  }
}

async function unparkElastic(def: LabPoolDef): Promise<boolean> {
  if (!def.elasticNodePool || !def.elasticCpuLimit) return false;
  if (!(await karpenterInstalled())) {
    console.warn(
      `[pool-autoscale] ${def.pool}: Karpenter CRDs missing — cannot unpark ${def.elasticNodePool}`,
    );
    return false;
  }
  const cpu = await nodepoolCpuLimit(def.elasticNodePool);
  if (cpu == null) {
    if (!def.nodepoolManifest) {
      console.warn(`[pool-autoscale] ${def.pool}: NodePool ${def.elasticNodePool} missing and no manifest`);
      return false;
    }
    console.log(`[pool-autoscale] applying NodePool ${def.elasticNodePool}`);
    try {
      await applyManifest(def.nodepoolManifest);
    } catch (err) {
      console.warn(
        `[pool-autoscale] apply ${def.elasticNodePool} failed: ${(err as Error).message || err}`,
      );
      return false;
    }
  }
  const patch = JSON.stringify({
    spec: { limits: { cpu: def.elasticCpuLimit } },
  });
  await k8s.kubectlOk(
    ['patch', 'nodepool', def.elasticNodePool, '--type', 'merge', '-p', patch],
    { timeoutMs: 30_000 },
  );
  console.log(`[pool-autoscale] ${def.pool}: elastic ${def.elasticNodePool} limits.cpu → ${def.elasticCpuLimit}`);
  return true;
}

async function parkElastic(def: LabPoolDef): Promise<void> {
  if (!def.elasticNodePool) return;
  const cpu = await nodepoolCpuLimit(def.elasticNodePool);
  if (cpu == null) return;
  await k8s.kubectlOk(
    ['patch', 'nodepool', def.elasticNodePool, '--type', 'merge', '-p', '{"spec":{"limits":{"cpu":"0"}}}'],
    { timeoutMs: 30_000 },
  );
  try {
    await k8s.kubectlOk(
      ['delete', 'nodeclaims', '-l', `karpenter.sh/nodepool=${def.elasticNodePool}`, '--wait=true', '--timeout=10m'],
      { timeoutMs: 11 * 60_000 },
    );
  } catch (err) {
    console.warn(
      `[pool-autoscale] ${def.pool}: NodeClaim delete: ${(err as Error).message || err}`,
    );
  }
  console.log(`[pool-autoscale] ${def.pool}: parked elastic ${def.elasticNodePool}`);
}

async function scaleNodegroup(nodegroup: string, desired: number, max: number): Promise<void> {
  const cluster = process.env.K8S_LAB_EKS_CLUSTER || process.env.EKS_CLUSTER_NAME || 'devlabs';
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-south-2';
  let EKSClient: new (cfg: { region: string }) => {
    send: (cmd: unknown) => Promise<unknown>;
  };
  let UpdateNodegroupConfigCommand: new (input: unknown) => unknown;
  let DescribeNodegroupCommand: new (input: unknown) => unknown;
  try {
    // Lazy require so Linux-only / kubectl-only deploys work without the package until installed.
    ({
      EKSClient,
      UpdateNodegroupConfigCommand,
      DescribeNodegroupCommand,
    } = require('@aws-sdk/client-eks'));
  } catch {
    throw new Error(
      '@aws-sdk/client-eks is required to scale managed node groups (base_plus_elastic pools)',
    );
  }
  const client = new EKSClient({ region });
  const min = desired;
  await client.send(new UpdateNodegroupConfigCommand({
    clusterName: cluster,
    nodegroupName: nodegroup,
    scalingConfig: {
      minSize: min,
      maxSize: Math.max(max, desired, 1),
      desiredSize: desired,
    },
  }));
  const deadline = Date.now() + WAKE_TIMEOUT_MS();
  while (Date.now() < deadline) {
    const desc = await client.send(new DescribeNodegroupCommand({
      clusterName: cluster,
      nodegroupName: nodegroup,
    })) as { nodegroup?: { status?: string; scalingConfig?: { desiredSize?: number } } };
    const status = desc.nodegroup?.status;
    const got = desc.nodegroup?.scalingConfig?.desiredSize;
    if (status === 'ACTIVE' && got === desired) return;
    if (status === 'CREATE_FAILED' || status === 'DELETE_FAILED' || status === 'DEGRADED') {
      throw new Error(`nodegroup ${nodegroup} status ${status}`);
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error(`nodegroup ${nodegroup} did not become ACTIVE at desired=${desired}`);
}

async function waitReadyNode(pool: string): Promise<void> {
  const deadline = Date.now() + WAKE_TIMEOUT_MS();
  while (Date.now() < deadline) {
    capacity.invalidatePool(pool);
    if (await capacity.poolUp(pool)) return;
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error(`no Ready node for pool=${pool} within ${WAKE_TIMEOUT_MS()}ms`);
}

async function wakeManagedBase(def: LabPoolDef): Promise<void> {
  if (!def.nodegroup) {
    throw new Error(`pool ${def.pool}: no managed nodegroup to wake`);
  }
  await scaleNodegroup(def.nodegroup, 1, 1);
  await ensurePlugins(def);
  await waitReadyNode(def.pool);
  capacity.invalidatePool(def.pool);
}

async function wakePoolOnce(def: LabPoolDef): Promise<void> {
  const t0 = Date.now();
  waking.add(def.pool);
  try {
    if (def.mode === 'elastic_only') {
      // Never scale the managed NG — capacity is Karpenter-only.
      await ensurePlugins(def);
      const elasticOk = await unparkElastic(def);
      capacity.invalidatePool(def.pool);
      if (!elasticOk) {
        throw Object.assign(
          new Error(
            `Elastic pool for ${def.pool} is not available (Karpenter NodePool missing). `
            + 'Install with ./deploy/eks/eks-karpenter.sh then the track up script '
            + '(eks-linux.sh / eks-docker.sh / eks-karpenter for labs-elastic).',
          ),
          { status: 503, code: 'LAB_ENV_UNAVAILABLE' },
        );
      }
      console.log(
        `[pool-autoscale] wake pool=${def.pool} mode=elastic_only durationMs=${Date.now() - t0}`,
      );
      return;
    }

    if (def.mode === 'base_plus_elastic') {
      await wakeManagedBase(def);
      await unparkElastic(def);
      console.log(
        `[pool-autoscale] wake pool=${def.pool} mode=base_plus_elastic durationMs=${Date.now() - t0}`,
      );
    }
  } finally {
    waking.delete(def.pool);
  }
}

/**
 * Ensure the pool can run a lab. For elastic_only, restores NodePool limits only
 * (does not wait for a Ready node — the Pending box triggers Karpenter).
 */
async function ensurePoolAwake(pool: string, opts?: { onPhase?: (msg: string) => void }): Promise<void> {
  if (!AUTOSCALE()) {
    capacity.invalidatePool(pool);
    if (await poolCapacityReady(pool)) return;
    if (await capacity.poolUp(pool)) return;
    throw Object.assign(
      new Error(
        'The machines that run these labs are offline right now, so your lab could not start. '
        + 'Please try again later, and contact the administrator if it keeps happening.',
      ),
      { status: 503, code: 'LAB_ENV_UNAVAILABLE' },
    );
  }

  const def = getPool(pool);
  if (!def || def.mode === 'always_on') {
    capacity.invalidatePool(pool);
    if (await capacity.poolUp(pool)) return;
    throw Object.assign(new Error('Lab platform nodes are offline.'), {
      status: 503,
      code: 'LAB_ENV_UNAVAILABLE',
    });
  }

  capacity.invalidatePool(pool);
  if (await poolCapacityReady(pool)) {
    // elastic_only: limits > 0 is enough. base_plus_elastic: poolUp already inside ready.
    if (def.mode === 'elastic_only' || await capacity.poolUp(pool)) return;
  }

  emptySince.delete(pool);

  let p = wakeInflight.get(pool);
  if (!p) {
    opts?.onPhase?.('Waking machines…');
    p = wakePoolOnce(def).finally(() => {
      wakeInflight.delete(pool);
    });
    wakeInflight.set(pool, p);
  } else {
    opts?.onPhase?.('Waking machines…');
  }
  await p;

  capacity.invalidatePool(pool);
  if (def.mode === 'elastic_only') {
    // After fallback NG wake, Ready nodes must exist. After true elastic unpark,
    // limits.cpu > 0 is enough (or a Ready node if Karpenter already provisioned).
    if (await poolCapacityReady(pool) || await capacity.poolUp(pool)) return;
    throw Object.assign(
      new Error('Could not wake the Linux lab pool. Please try again or contact the administrator.'),
      { status: 503, code: 'LAB_ENV_UNAVAILABLE' },
    );
  }
  if (!(await capacity.poolUp(pool))) {
    throw Object.assign(
      new Error(
        'The machines that run these labs are offline right now, so your lab could not start. '
        + 'Please try again later, and contact the administrator if it keeps happening.',
      ),
      { status: 503, code: 'LAB_ENV_UNAVAILABLE' },
    );
  }
}

async function parkPool(def: LabPoolDef): Promise<void> {
  if (def.mode === 'always_on') return;
  if (waking.has(def.pool) || wakeInflight.has(def.pool)) return;
  const t0 = Date.now();
  await parkElastic(def);
  if (def.mode === 'base_plus_elastic' && def.nodegroup) {
    try {
      await scaleNodegroup(def.nodegroup, 0, 1);
    } catch (err) {
      console.warn(
        `[pool-autoscale] sleep NG ${def.nodegroup}: ${(err as Error).message || err}`,
      );
    }
  }
  capacity.invalidatePool(def.pool);
  emptySince.delete(def.pool);
  console.log(`[pool-autoscale] sleep pool=${def.pool} durationMs=${Date.now() - t0}`);
}

/** Map an active session to a capacity pool label, or null. */
function sessionPool(session: Record<string, unknown>): string | null {
  const challengeId = String(session.challengeId || '');
  if (!challengeId) return null;
  const ch = loader.getChallenge(challengeId);
  if (!ch) return null;
  const st = ch.sandboxType;
  if (st === 'kafka') return 'kafka';
  if (st === 'spark') return 'spark';
  if (isBoxLabType(st)) {
    if (st === 'docker') return 'docker';
    return 'linux';
  }
  // DevOps Kubernetes + k8s-platform share the labs Karpenter pool.
  if (st === 'k8s' || st === 'kubernetes' || st === 'k8s-platform') return 'labs';
  return null;
}

async function learnerPodCount(pool: string): Promise<number> {
  try {
    // Pods that select this pool (nodeName set or Pending with the selector).
    const out = await k8s.kubectlOk(
      [
        'get', 'pods', '-A',
        '-l', `devlabs.io/component`,
        '-o', 'json',
      ],
      { timeoutMs: 30_000 },
    ).catch(() => '');
    // Broader: count pods on nodes with this pool label + Pending with nodeSelector.
    const nodes = await kubectlJson<{ items: Array<{ metadata?: { name?: string } }> }>([
      'get', 'nodes', '-l', `devlabs.io/pool=${pool}`,
    ]).catch(() => ({ items: [] as Array<{ metadata?: { name?: string } }> }));
    const nodeNames = new Set(nodes.items.map((n) => n.metadata?.name).filter(Boolean) as string[]);

    const all = await kubectlJson<{
      items: Array<{
        metadata?: { namespace?: string; deletionTimestamp?: string };
        spec?: { nodeName?: string; nodeSelector?: Record<string, string> };
        status?: { phase?: string };
      }>;
    }>(['get', 'pods', '-A']).catch(() => ({ items: [] }));

    let n = 0;
    for (const pod of all.items) {
      if (pod.metadata?.deletionTimestamp) continue;
      const ns = pod.metadata?.namespace || '';
      // Skip platform / kube-system noise; learner labs use ns-*, lx-*, dk-*, etc.
      if (ns === 'kube-system' || ns === 'dl-system' || ns === 'dl-mirror') continue;
      const onNode = pod.spec?.nodeName && nodeNames.has(pod.spec.nodeName);
      const selects = pod.spec?.nodeSelector?.['devlabs.io/pool'] === pool;
      if (onNode || selects) n += 1;
    }
    void out;
    return n;
  } catch {
    return -1; // unknown → do not sleep
  }
}

function hasActiveWork(pool: string): boolean {
  try {
    const k8sLifecycle = require('./k8sLifecycle');
    for (const s of sessionStore.all() as Array<Record<string, unknown>>) {
      if (s.status !== 'active') continue;
      if (sessionPool(s) !== pool) continue;
      if (s.runtime === 'kubernetes' && k8sLifecycle.isStartInFlight(String(s.id))) return true;
      return true;
    }
  } catch {
    return true;
  }
  return wakeInflight.has(pool) || waking.has(pool);
}

async function sweepOnce(): Promise<void> {
  if (!AUTOSCALE()) return;
  const now = Date.now();
  const grace = GRACE_MS();
  for (const def of allSleepablePools()) {
    // elastic_only tracks (linux / labs / docker) sleep by default.
    // Other tracks need POOL_AUTOSCALE_ALL=1.
    if (def.mode !== 'elastic_only' && process.env.POOL_AUTOSCALE_ALL !== '1') continue;

    if (hasActiveWork(def.pool)) {
      emptySince.delete(def.pool);
      continue;
    }
    const pods = await learnerPodCount(def.pool);
    if (pods < 0) continue;
    if (pods > 0) {
      emptySince.delete(def.pool);
      continue;
    }

    // Already parked?
    if (def.mode === 'elastic_only' && def.elasticNodePool) {
      const cpu = await nodepoolCpuLimit(def.elasticNodePool);
      if (cpu === 0) {
        emptySince.delete(def.pool);
        continue;
      }
      if (cpu == null) continue;
    }

    const since = emptySince.get(def.pool);
    if (since == null) {
      emptySince.set(def.pool, now);
      continue;
    }
    if (now - since < grace) continue;

    try {
      await parkPool(def);
    } catch (err) {
      console.warn(`[pool-autoscale] sleep failed pool=${def.pool}: ${(err as Error).message || err}`);
    }
  }
}

function startPoolAutoscale(): void {
  if (!AUTOSCALE()) {
    console.log('[pool-autoscale] disabled (POOL_AUTOSCALE=0)');
    return;
  }
  if (sweepTimer) return;
  console.log(
    `[pool-autoscale] on (grace=${Math.round(GRACE_MS() / 1000)}s sweep=${Math.round(SWEEP_MS() / 1000)}s `
    + `linuxMode=${getPool('linux')?.mode || '?'})`,
  );
  sweepTimer = setInterval(() => {
    void sweepOnce();
  }, SWEEP_MS());
  if (typeof sweepTimer.unref === 'function') sweepTimer.unref();
}

function stopPoolAutoscale(): void {
  if (!sweepTimer) return;
  clearInterval(sweepTimer);
  sweepTimer = null;
}

module.exports = {
  ensurePoolAwake,
  parkPool,
  poolCapacityReady,
  isWaking,
  startPoolAutoscale,
  stopPoolAutoscale,
  sweepOnce,
  AUTOSCALE,
  GRACE_MS,
};
