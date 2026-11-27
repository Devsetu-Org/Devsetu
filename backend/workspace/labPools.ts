'use strict';

/**
 * Lab capacity registry: which node pool runs each track, and how it wakes/sleeps.
 *
 * linux / labs (Kubernetes) / docker — elastic_only (Karpenter NodePools; managed NGs stay at 0).
 * Other tracks — base_plus_elastic until converted the same way.
 */

export type PoolMode = 'elastic_only' | 'base_plus_elastic' | 'always_on';

export type LabPoolDef = {
  /** Value of node label/taint `devlabs.io/pool`. */
  pool: string;
  mode: PoolMode;
  /** Managed EKS node group name (may stay Desired=0 for elastic_only). */
  nodegroup: string | null;
  /** Karpenter NodePool name, or null for system. */
  elasticNodePool: string | null;
  instanceType: string;
  /** Restored Karpenter limits.cpu when awake. */
  elasticCpuLimit: string | null;
  maxNodes: number;
  /** Path under deploy/eks for kubectl apply on wake (elastic NodePool + EC2NodeClass). */
  nodepoolManifest: string | null;
  plugins: Array<'nri-linux' | 'seccomp-linux' | 'nri-docker' | 'seccomp-docker' | 'mirror-docker'>;
};

function trackMode(envKey: string, defaultMode: PoolMode = 'elastic_only'): PoolMode {
  const raw = String(process.env[envKey] || defaultMode).trim().toLowerCase();
  if (raw === 'base_plus_elastic' || raw === 'base') return 'base_plus_elastic';
  if (raw === 'elastic_only' || raw === 'elastic') return 'elastic_only';
  return defaultMode;
}

const LAB_POOLS: LabPoolDef[] = [
  {
    pool: 'system',
    mode: 'always_on',
    nodegroup: 'system-k8s',
    elasticNodePool: null,
    instanceType: 't4g.medium',
    elasticCpuLimit: null,
    maxNodes: 2,
    nodepoolManifest: null,
    plugins: [],
  },
  {
    pool: 'linux',
    mode: trackMode('POOL_LINUX_MODE', 'elastic_only'),
    nodegroup: 'labs-linux',
    elasticNodePool: 'labs-linux-elastic',
    instanceType: 't4g.medium',
    elasticCpuLimit: '4',
    maxNodes: 2,
    nodepoolManifest: 'karpenter/nodepool-linux.yaml',
    plugins: ['nri-linux', 'seccomp-linux'],
  },
  {
    pool: 'labs',
    mode: trackMode('POOL_LABS_MODE', 'elastic_only'),
    nodegroup: 'labs-k8s',
    elasticNodePool: 'labs-elastic',
    instanceType: 't4g.medium',
    elasticCpuLimit: '4',
    maxNodes: 2,
    nodepoolManifest: 'karpenter/nodepool.yaml',
    plugins: [],
  },
  {
    pool: 'docker',
    mode: trackMode('POOL_DOCKER_MODE', 'elastic_only'),
    nodegroup: 'labs-docker',
    elasticNodePool: 'labs-docker-elastic',
    instanceType: 't4g.medium',
    elasticCpuLimit: '4',
    maxNodes: 2,
    nodepoolManifest: 'karpenter/nodepool-docker.yaml',
    plugins: ['nri-docker', 'seccomp-docker', 'mirror-docker'],
  },
  {
    pool: 'spark',
    mode: 'base_plus_elastic',
    nodegroup: 'labs-spark',
    elasticNodePool: 'labs-spark-elastic',
    instanceType: 't4g.medium',
    elasticCpuLimit: '2',
    maxNodes: 2,
    nodepoolManifest: 'karpenter/nodepool-spark.yaml',
    plugins: [],
  },
  {
    pool: 'spark-de',
    mode: 'base_plus_elastic',
    nodegroup: 'labs-spark-de',
    elasticNodePool: 'labs-spark-de-elastic',
    instanceType: 't4g.medium',
    elasticCpuLimit: '2',
    maxNodes: 2,
    nodepoolManifest: 'karpenter/nodepool-spark-de.yaml',
    plugins: [],
  },
  {
    pool: 'kafka',
    mode: 'base_plus_elastic',
    nodegroup: 'labs-kafka',
    elasticNodePool: 'labs-kafka-elastic',
    instanceType: 't4g.medium',
    elasticCpuLimit: '2',
    maxNodes: 2,
    nodepoolManifest: 'karpenter/nodepool-kafka.yaml',
    plugins: [],
  },
  {
    pool: 'projects',
    mode: 'base_plus_elastic',
    nodegroup: 'labs-projects',
    elasticNodePool: 'labs-projects-elastic',
    instanceType: 't4g.small',
    elasticCpuLimit: '4',
    maxNodes: 3,
    nodepoolManifest: 'karpenter/nodepool-projects.yaml',
    plugins: [],
  },
];

function getPool(pool: string | null | undefined): LabPoolDef | null {
  if (!pool) return null;
  return LAB_POOLS.find((p) => p.pool === pool) || null;
}

function allSleepablePools(): LabPoolDef[] {
  return LAB_POOLS.filter((p) => p.mode !== 'always_on');
}

function neverSleepPools(): LabPoolDef[] {
  return LAB_POOLS.filter((p) => p.mode === 'always_on');
}

/** @deprecated use trackMode('POOL_LINUX_MODE') via getPool('linux') */
function linuxMode(): PoolMode {
  return trackMode('POOL_LINUX_MODE', 'elastic_only');
}

module.exports = {
  LAB_POOLS,
  getPool,
  allSleepablePools,
  neverSleepPools,
  linuxMode,
};
