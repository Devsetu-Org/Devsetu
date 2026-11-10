'use strict';

/**
 * Spark lab clusters: procured DevSetu hosts + a shell pod, in sp-<user>,
 * deleted when the lab ends. Hostnames look like real inventory (ds-spark-01…).
 *
 * Shapes:
 *   spark-2 / spark-3 — standalone Master + Workers (Chapter 1)
 *   yarn-2            — YARN ResourceManager + 2 NodeManagers (Chapter 2)
 *
 * Role is only in the guide / UI labels — never in the hostname.
 * Pods select and tolerate devlabs.io/pool=spark (labs-spark / labs-spark-elastic).
 */

const k8s = require('./k8sCluster');

const SHELL = 'shell';
/** First procured node — Master (standalone) or ResourceManager (YARN). */
const MASTER = 'ds-spark-01';
const IMAGE = process.env.SPARK_LAB_IMAGE || 'apache/spark:3.5.3';
const YARN_IMAGE = process.env.SPARK_YARN_LAB_IMAGE || 'devsetu/spark-yarn-lab:v0.1';
const POOL = 'spark';
const LAB_LABEL = 'app=spark-lab';
const READY_TIMEOUT_S = 360;
const DELETE_GRACE_S = '5';
/** Pod clock includes image pull. The lab clock is 45 minutes and starts later. */
const ACTIVE_DEADLINE_S = 90 * 60;
const MASTER_PORT = 7077;
const MASTER_UI_PORT = 8080;
const WORKER_UI_BASE = 8081;
const YARN_RM_UI_PORT = 8088;
const YARN_NM_UI_PORT = 8042;

const WORKERS_SPARK_3 = [
  { name: 'ds-spark-02', uiPort: 8081 },
  { name: 'ds-spark-03', uiPort: 8082 },
  { name: 'ds-spark-04', uiPort: 8083 },
];

const WORKERS_SPARK_2 = WORKERS_SPARK_3.slice(0, 2);

const YARN_NMS = [
  { name: 'ds-spark-02', uiPort: YARN_NM_UI_PORT },
  { name: 'ds-spark-03', uiPort: YARN_NM_UI_PORT },
];

type SparkShape = 'spark-3' | 'spark-2' | 'yarn-2';
/** auto = Master/Worker already running. manual = nodes only; learner brings Spark up. */
type DaemonMode = 'auto' | 'manual';

function isYarnShape(shape: SparkShape): boolean {
  return shape === 'yarn-2';
}

function imageFor(shape: SparkShape): string {
  return isYarnShape(shape) ? YARN_IMAGE : IMAGE;
}

function workersFor(shape: SparkShape): typeof WORKERS_SPARK_3 {
  if (shape === 'yarn-2') return YARN_NMS as typeof WORKERS_SPARK_3;
  return shape === 'spark-2' ? WORKERS_SPARK_2 : WORKERS_SPARK_3;
}

function namespace(userName: string): string {
  return String(k8s.learnerNamespace(userName)).replace(/^ns-/, 'sp-');
}

function labelValue(raw: string): string {
  return raw.replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 63).replace(/[^A-Za-z0-9]+$/, '') || 'lab';
}

/**
 * Learner-facing master URL. Short DNS names resolve in-namespace via the
 * headless Services below — never expose *.svc.cluster.local in the shell.
 */
function masterUrl(_ns?: string): string {
  return `spark://${MASTER}:${MASTER_PORT}`;
}

function masterUi(_ns?: string): string {
  return `http://${MASTER}:${MASTER_UI_PORT}`;
}

function yarnRmUi(_ns?: string): string {
  return `http://${MASTER}:${YARN_RM_UI_PORT}`;
}

function scriptEnv(ns: string): Record<string, string> {
  if (!ns) throw new Error('spark scriptEnv requires the learner namespace');
  return {
    SPARK_POD: SHELL,
    SHELL_CONTAINER: SHELL,
    SPARK_MASTER: masterUrl(ns),
    SPARK_MASTER_UI: masterUi(ns),
    SPARK_MASTER_POD: MASTER,
    YARN_RM_HOST: MASTER,
    YARN_RM_UI: yarnRmUi(ns),
    YARN_RM_POD: MASTER,
  };
}

const EXIT_NOTICE = 'This cluster stays. Submit to solve the lab. Here is a fresh shell.';

/** Allowed terminal targets: shell (default) or a daemon pod (master / worker-*). */
function resolveShellPod(node: string | null | undefined): { pod: string; container: string } {
  const raw = String(node || SHELL).trim();
  const allowed = new Set<string>([
    SHELL,
    MASTER,
    ...WORKERS_SPARK_3.map((w) => w.name),
  ]);
  const pod = allowed.has(raw) ? raw : SHELL;
  return { pod, container: pod };
}

function shellExecArgs(ns: string, node?: string | null): string[] {
  const { pod, container } = resolveShellPod(node);
  const notice = EXIT_NOTICE.replace(/'/g, '');
  const relaunch =
    'while :; do if bash --noprofile --norc -i; then '
    + `printf '\\033[A\\033[2K\\r\\033[38;5;179m${notice}\\033[0m\\n'; `
    + 'else sleep 1; fi; done';
  return ['exec', '-it', '-n', ns, pod, '-c', container, '--', 'bash', '-c', relaunch];
}

function namespaceYaml(ns: string): string {
  return `
apiVersion: v1
kind: Namespace
metadata:
  name: ${ns}
  labels:
    app.kubernetes.io/managed-by: devlabs
    app.kubernetes.io/component: spark-lab
    pod-security.kubernetes.io/enforce: baseline
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: dl-spark-isolation
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

function podScheduling(): string {
  return `  automountServiceAccountToken: false
  enableServiceLinks: false
  terminationGracePeriodSeconds: 15
  activeDeadlineSeconds: ${ACTIVE_DEADLINE_S}
  nodeSelector:
    devlabs.io/pool: ${POOL}
  affinity:
    nodeAffinity:
      preferredDuringSchedulingIgnoredDuringExecution:
        - weight: 100
          preference:
            matchExpressions:
              - {key: devlabs.io/tier, operator: In, values: [base]}
    podAffinity:
      preferredDuringSchedulingIgnoredDuringExecution:
        - weight: 100
          podAffinityTerm:
            topologyKey: kubernetes.io/hostname
            labelSelector:
              matchLabels:
                app: spark-lab
  tolerations:
    - key: devlabs.io/pool
      value: ${POOL}
      effect: NoSchedule`;
}

function podLabels(challengeId: string, component: string, shape: SparkShape): string {
  return `    app.kubernetes.io/managed-by: devlabs
    app: spark-lab
    component: ${component}
    shape: ${shape}
    ${k8s.CHALLENGE_LABEL}: ${labelValue(challengeId)}`;
}

function masterServiceYaml(ns: string): string {
  return `
apiVersion: v1
kind: Service
metadata:
  name: ${MASTER}
  namespace: ${ns}
  labels:
    app.kubernetes.io/managed-by: devlabs
    app: spark-lab
spec:
  clusterIP: None
  publishNotReadyAddresses: true
  selector:
    app: spark-lab
    component: master
  ports:
    - {name: spark, port: ${MASTER_PORT}, targetPort: ${MASTER_PORT}}
    - {name: ui, port: ${MASTER_UI_PORT}, targetPort: ${MASTER_UI_PORT}}
`;
}

/** Headless Service so each `ds-spark-N` hostname resolves like a real node. */
function workerServiceYaml(ns: string, worker: { name: string; uiPort: number }): string {
  return `
apiVersion: v1
kind: Service
metadata:
  name: ${worker.name}
  namespace: ${ns}
  labels:
    app.kubernetes.io/managed-by: devlabs
    app: spark-lab
spec:
  clusterIP: None
  publishNotReadyAddresses: true
  selector:
    app: spark-lab
    spark-node: ${worker.name}
  ports:
    - {name: ui, port: ${worker.uiPort}, targetPort: ${worker.uiPort}}
`;
}

/**
 * Headless Service for the learner shell. Client-mode drivers advertise
 * spark://shell:<port>; Workers must resolve `shell` or executors EXIT with
 * UnknownHostException (looks like a memory failure in the submit log).
 */
function shellServiceYaml(ns: string): string {
  return `
apiVersion: v1
kind: Service
metadata:
  name: ${SHELL}
  namespace: ${ns}
  labels:
    app.kubernetes.io/managed-by: devlabs
    app: spark-lab
spec:
  clusterIP: None
  publishNotReadyAddresses: true
  selector:
    app: spark-lab
    component: shell
  ports:
    - {name: app-ui, port: 4040, targetPort: 4040}
`;
}

function yarnRmServiceYaml(ns: string): string {
  return `
apiVersion: v1
kind: Service
metadata:
  name: ${MASTER}
  namespace: ${ns}
  labels:
    app.kubernetes.io/managed-by: devlabs
    app: spark-lab
spec:
  clusterIP: None
  publishNotReadyAddresses: true
  selector:
    app: spark-lab
    component: rm
  ports:
    - {name: ui, port: ${YARN_RM_UI_PORT}, targetPort: ${YARN_RM_UI_PORT}}
    - {name: rm, port: 8032, targetPort: 8032}
    - {name: sched, port: 8030, targetPort: 8030}
    - {name: tracker, port: 8031, targetPort: 8031}
`;
}

function yarnNmServiceYaml(ns: string, node: { name: string; uiPort: number }): string {
  return `
apiVersion: v1
kind: Service
metadata:
  name: ${node.name}
  namespace: ${ns}
  labels:
    app.kubernetes.io/managed-by: devlabs
    app: spark-lab
spec:
  clusterIP: None
  publishNotReadyAddresses: true
  selector:
    app: spark-lab
    spark-node: ${node.name}
  ports:
    - {name: ui, port: ${node.uiPort}, targetPort: ${node.uiPort}}
    - {name: nm, port: 8040, targetPort: 8040}
    - {name: localizer, port: 8041, targetPort: 8041}
`;
}

function yarnNodeEnv(nodeName: string): string {
  return `        - {name: PATH, value: "/opt/spark/bin:/opt/spark/sbin:/opt/hadoop/bin:/opt/hadoop/sbin:/opt/java/openjdk/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"}
        - {name: HOME, value: "/home/spark"}
        - {name: JAVA_HOME, value: "/opt/java/openjdk"}
        - {name: HADOOP_HOME, value: "/opt/hadoop"}
        - {name: HADOOP_CONF_DIR, value: "/opt/hadoop/etc/hadoop"}
        - {name: YARN_CONF_DIR, value: "/opt/hadoop/etc/hadoop"}
        - {name: SPARK_HOME, value: "/opt/spark"}
        - {name: SPARK_CONF_DIR, value: "/opt/spark/conf"}
        - {name: YARN_RM_HOST, value: "${MASTER}"}
        - {name: SPARK_LOCAL_HOSTNAME, value: "${nodeName}"}
        - {name: NM_MEMORY_MB, value: "1536"}
        - {name: NM_VCORES, value: "2"}`;
}

function yarnIdleProbe(): string {
  return `      command: ["/bin/sleep", "infinity"]
      workingDir: /opt/spark
      readinessProbe:
        exec: {command: ["test", "-x", "/opt/lab/bin/write-yarn-conf.sh"]}
        initialDelaySeconds: 2
        periodSeconds: 5
        timeoutSeconds: 2
        failureThreshold: 36`;
}

function yarnRmPod(ns: string, challengeId: string, shape: SparkShape): string {
  return `
apiVersion: v1
kind: Pod
metadata:
  name: ${MASTER}
  namespace: ${ns}
  labels:
${podLabels(challengeId, 'rm', shape)}
    spark-node: ${MASTER}
  annotations:
    karpenter.sh/do-not-disrupt: "true"
spec:
  hostname: ${MASTER}
${podScheduling()}
  containers:
    - name: ${MASTER}
      image: ${imageFor(shape)}
      imagePullPolicy: IfNotPresent
${yarnIdleProbe()}
      env:
${yarnNodeEnv(MASTER)}
      ports:
        - {containerPort: ${YARN_RM_UI_PORT}, name: ui}
        - {containerPort: 8032, name: rm}
        - {containerPort: 8030, name: sched}
        - {containerPort: 8031, name: tracker}
      resources:
        requests: {cpu: 100m, memory: 768Mi}
        limits: {cpu: 500m, memory: 1024Mi}
`;
}

function yarnNmPod(
  ns: string,
  challengeId: string,
  shape: SparkShape,
  node: { name: string; uiPort: number },
): string {
  return `
apiVersion: v1
kind: Pod
metadata:
  name: ${node.name}
  namespace: ${ns}
  labels:
${podLabels(challengeId, 'nm', shape)}
    spark-node: ${node.name}
  annotations:
    karpenter.sh/do-not-disrupt: "true"
spec:
  hostname: ${node.name}
${podScheduling()}
  containers:
    - name: ${node.name}
      image: ${imageFor(shape)}
      imagePullPolicy: IfNotPresent
${yarnIdleProbe()}
      env:
${yarnNodeEnv(node.name)}
      ports:
        - {containerPort: ${node.uiPort}, name: ui}
        - {containerPort: 8040, name: nm}
        - {containerPort: 8041, name: localizer}
      resources:
        requests: {cpu: 50m, memory: 896Mi}
        limits: {cpu: 200m, memory: 1Gi}
`;
}

function yarnShellPod(ns: string, challengeId: string, shape: SparkShape): string {
  return `
apiVersion: v1
kind: Pod
metadata:
  name: ${SHELL}
  namespace: ${ns}
  labels:
${podLabels(challengeId, 'shell', shape)}
  annotations:
    karpenter.sh/do-not-disrupt: "true"
spec:
  hostname: ${SHELL}
${podScheduling()}
  containers:
    - name: ${SHELL}
      image: ${imageFor(shape)}
      imagePullPolicy: IfNotPresent
      command: ["/bin/sleep", "infinity"]
      workingDir: /opt/spark
      env:
        - {name: PATH, value: "/opt/spark/bin:/opt/spark/sbin:/opt/hadoop/bin:/opt/hadoop/sbin:/opt/java/openjdk/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"}
        - {name: HOME, value: "/home/spark"}
        - {name: JAVA_HOME, value: "/opt/java/openjdk"}
        - {name: HADOOP_HOME, value: "/opt/hadoop"}
        - {name: HADOOP_CONF_DIR, value: "/opt/hadoop/etc/hadoop"}
        - {name: YARN_CONF_DIR, value: "/opt/hadoop/etc/hadoop"}
        - {name: SPARK_HOME, value: "/opt/spark"}
        - {name: SPARK_CONF_DIR, value: "/opt/spark/conf"}
        - {name: YARN_RM_HOST, value: "${MASTER}"}
        - {name: YARN_RM_UI, value: "${yarnRmUi()}"}
        - {name: SPARK_LOCAL_HOSTNAME, value: "${SHELL}"}
        - {name: PS1, value: "spark $ "}
      resources:
        requests: {cpu: 50m, memory: 256Mi}
        limits: {cpu: 500m, memory: 1Gi}
`;
}

function nodeCommonEnv(nodeName: string): string {
  const master = masterUrl();
  // Do NOT set SPARK_MASTER here — spark-daemon.sh treats it as an rsync *host*
  // ("rsync from spark://…") and fails noisily. Learners use SPARK_MASTER_URL.
  // HOME must be writable in apache/spark — that image has no /home/spark.
  // SPARK_WORKER_CORES=1 matches the 768m offer (one 512m+128m executor per Worker).
  return `        - {name: PATH, value: "/opt/spark/bin:/opt/spark/sbin:/opt/java/openjdk/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"}
        - {name: HOME, value: "/opt/spark"}
        - {name: SPARK_HOME, value: "/opt/spark"}
        - {name: SPARK_CONF_DIR, value: "/opt/spark/conf"}
        - {name: SPARK_MASTER_URL, value: "${master}"}
        - {name: SPARK_MASTER_HOST, value: "${MASTER}"}
        - {name: SPARK_MASTER_PORT, value: "${MASTER_PORT}"}
        - {name: SPARK_MASTER_WEBUI_PORT, value: "${MASTER_UI_PORT}"}
        - {name: SPARK_LOCAL_HOSTNAME, value: "${nodeName}"}
        - {name: SPARK_DAEMON_MEMORY, value: "256m"}
        - {name: SPARK_WORKER_CORES, value: "1"}
        - {name: SPARK_WORKER_MEMORY, value: "768m"}`;
}

/** Idle node: Spark installed, no Master/Worker yet (learner bring-up labs). */
function idleNodeProbe(): string {
  return `      command: ["/bin/sleep", "infinity"]
      workingDir: /opt/spark
      readinessProbe:
        exec: {command: ["test", "-d", "/opt/spark"]}
        initialDelaySeconds: 2
        periodSeconds: 5
        timeoutSeconds: 2
        failureThreshold: 12`;
}

function masterPod(ns: string, challengeId: string, shape: SparkShape, daemonMode: DaemonMode): string {
  const running =
    daemonMode === 'auto'
      ? `      command: ["/opt/spark/bin/spark-class"]
      args: ["org.apache.spark.deploy.master.Master", "--host", "${MASTER}", "--port", "${MASTER_PORT}", "--webui-port", "${MASTER_UI_PORT}"]
      env:
        - {name: SPARK_NO_DAEMONIZE, value: "true"}
${nodeCommonEnv(MASTER)}
      ports:
        - {containerPort: ${MASTER_PORT}, name: spark}
        - {containerPort: ${MASTER_UI_PORT}, name: ui}
      readinessProbe:
        httpGet: {path: "/", port: ${MASTER_UI_PORT}}
        initialDelaySeconds: 8
        periodSeconds: 5
        timeoutSeconds: 3
        failureThreshold: 36`
      : `${idleNodeProbe()}
      env:
${nodeCommonEnv(MASTER)}
      ports:
        - {containerPort: ${MASTER_PORT}, name: spark}
        - {containerPort: ${MASTER_UI_PORT}, name: ui}`;
  return `
apiVersion: v1
kind: Pod
metadata:
  name: ${MASTER}
  namespace: ${ns}
  labels:
${podLabels(challengeId, 'master', shape)}
    spark-node: ${MASTER}
  annotations:
    karpenter.sh/do-not-disrupt: "true"
spec:
  hostname: ${MASTER}
${podScheduling()}
  containers:
    - name: ${MASTER}
      image: ${IMAGE}
      imagePullPolicy: IfNotPresent
${running}
      resources:
        requests: {cpu: 50m, memory: 384Mi}
        limits: {cpu: 200m, memory: 512Mi}
`;
}

function workerPod(
  ns: string,
  challengeId: string,
  shape: SparkShape,
  worker: { name: string; uiPort: number },
  daemonMode: DaemonMode,
): string {
  const master = masterUrl();
  const running =
    daemonMode === 'auto'
      ? `      command: ["/opt/spark/bin/spark-class"]
      args:
        - "org.apache.spark.deploy.worker.Worker"
        - "${master}"
        - "--webui-port"
        - "${worker.uiPort}"
        - "--cores"
        - "1"
        - "--memory"
        - "768m"
      env:
        - {name: SPARK_NO_DAEMONIZE, value: "true"}
${nodeCommonEnv(worker.name)}
        - {name: SPARK_WORKER_WEBUI_PORT, value: "${worker.uiPort}"}
      ports:
        - {containerPort: ${worker.uiPort}, name: ui}
      readinessProbe:
        httpGet: {path: "/", port: ${worker.uiPort}}
        initialDelaySeconds: 10
        periodSeconds: 5
        timeoutSeconds: 3
        failureThreshold: 36`
      : `${idleNodeProbe()}
      env:
${nodeCommonEnv(worker.name)}
        - {name: SPARK_WORKER_WEBUI_PORT, value: "${worker.uiPort}"}
      ports:
        - {containerPort: ${worker.uiPort}, name: ui}`;
  return `
apiVersion: v1
kind: Pod
metadata:
  name: ${worker.name}
  namespace: ${ns}
  labels:
${podLabels(challengeId, 'worker', shape)}
    spark-node: ${worker.name}
  annotations:
    karpenter.sh/do-not-disrupt: "true"
spec:
  hostname: ${worker.name}
${podScheduling()}
  containers:
    - name: ${worker.name}
      image: ${IMAGE}
      imagePullPolicy: IfNotPresent
${running}
      resources:
        # Request low for packing. Limit 1280Mi covers daemon (~256m) + one
        # 512m executor (+128m overhead) + PySpark RSS. Prior EXITED(code 1) at
        # this ceiling was UnknownHostException: shell, not cgroup OOM.
        requests: {cpu: 50m, memory: 512Mi}
        limits: {cpu: 750m, memory: 1280Mi}
`;
}

function shellPod(ns: string, challengeId: string, shape: SparkShape): string {
  const master = masterUrl();
  return `
apiVersion: v1
kind: Pod
metadata:
  name: ${SHELL}
  namespace: ${ns}
  labels:
${podLabels(challengeId, 'shell', shape)}
  annotations:
    karpenter.sh/do-not-disrupt: "true"
spec:
  hostname: ${SHELL}
${podScheduling()}
  containers:
    - name: ${SHELL}
      image: ${IMAGE}
      imagePullPolicy: IfNotPresent
      command: ["/bin/sleep", "infinity"]
      workingDir: /opt/spark
      env:
        - {name: PATH, value: "/opt/spark/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"}
        - {name: HOME, value: "/opt/spark"}
        - {name: SPARK_HOME, value: "/opt/spark"}
        - {name: SPARK_MASTER_URL, value: "${master}"}
        - {name: SPARK_MASTER_UI, value: "${masterUi()}"}
        - {name: SPARK_LOCAL_HOSTNAME, value: "${SHELL}"}
        - {name: SPARK_DRIVER_MEMORY, value: "512m"}
        - {name: PS1, value: "spark $ "}
      resources:
        # Client driver is SPARK_DRIVER_MEMORY=512m; 768Mi leaves modest RSS
        # headroom without blowing the t4g.medium ~3.3Gi allocatable budget
        # when Workers are also at 1280Mi each.
        requests: {cpu: 50m, memory: 256Mi}
        limits: {cpu: 500m, memory: 768Mi}
`;
}

function clusterYaml(
  ns: string,
  challengeId: string,
  shape: SparkShape,
  daemonMode: DaemonMode = 'auto',
): string {
  if (isYarnShape(shape)) {
    const nms = workersFor(shape);
    return [
      yarnRmServiceYaml(ns),
      ...nms.map((n) => yarnNmServiceYaml(ns, n)),
      shellServiceYaml(ns),
      yarnRmPod(ns, challengeId, shape),
      ...nms.map((n) => yarnNmPod(ns, challengeId, shape, n)),
      yarnShellPod(ns, challengeId, shape),
    ].join('---\n');
  }
  const workers = workersFor(shape);
  return [
    masterServiceYaml(ns),
    ...workers.map((w) => workerServiceYaml(ns, w)),
    shellServiceYaml(ns),
    masterPod(ns, challengeId, shape, daemonMode),
    ...workers.map((w) => workerPod(ns, challengeId, shape, w, daemonMode)),
    shellPod(ns, challengeId, shape),
  ].join('---\n');
}

const ensuredNamespaces = new Set<string>();

async function ensureNamespace(ns: string): Promise<void> {
  if (ensuredNamespaces.has(ns)) return;
  await k8s.kubectlOk(['apply', '-f', '-'], { input: namespaceYaml(ns), timeoutMs: 30_000 });
  ensuredNamespaces.add(ns);
}

async function describeNotReady(ns: string): Promise<string> {
  const r = await k8s.runKubectl(
    ['get', 'pods', '-n', ns, '-l', LAB_LABEL, '-o', 'wide'],
    { timeoutMs: 15_000 },
  );
  return (r.stdout || r.stderr || '').trim();
}

async function deleteCluster(ns: string, wait: boolean): Promise<void> {
  try {
    require('./sparkUiProxy').dropForwardsForNamespace(ns);
  } catch {
    /* proxy module optional during early boot */
  }
  const timeout = wait ? '90s' : '30s';
  await k8s.kubectlOk(
    ['delete', 'pod', '-n', ns, '-l', LAB_LABEL, '--ignore-not-found',
      `--grace-period=${DELETE_GRACE_S}`, `--wait=${wait}`, `--timeout=${timeout}`],
    { timeoutMs: wait ? 120_000 : 30_000 },
  );
  await k8s.kubectlOk(
    ['delete', 'service', '-n', ns, '-l', LAB_LABEL, '--ignore-not-found', '--wait=false'],
    { timeoutMs: 15_000 },
  );
}

/**
 * Ensure vi/vim exist on every lab host. apache/spark has neither; we drop a
 * static busybox into /opt/spark/bin (already on PATH). Yarn image may already
 * ship vim-tiny — this is a no-op then. Failures are soft (no egress → skip).
 */
async function ensureEditorsOnPods(ns: string, pods: string[]): Promise<void> {
  const script = `
set -euo pipefail
if command -v vim >/dev/null 2>&1 && command -v vi >/dev/null 2>&1; then
  exit 0
fi
dest=/opt/spark/bin
mkdir -p "$dest"
if [[ ! -x "$dest/busybox" ]]; then
  curl -fsSL --connect-timeout 8 --max-time 45 \
    'https://busybox.net/downloads/binaries/1.35.0-x86_64-linux-musl/busybox' \
    -o "$dest/busybox" || exit 0
  chmod +x "$dest/busybox"
fi
ln -sfn busybox "$dest/vi"
ln -sfn busybox "$dest/vim"
`.trim();
  await Promise.all(
    pods.map(async (pod) => {
      const r = await k8s.runKubectl(
        ['exec', '-n', ns, pod, '-c', pod, '--', 'bash', '-lc', script],
        { timeoutMs: 60_000 },
      );
      if (r.code !== 0) {
        console.warn(
          `[spark] ${ns}/${pod}: could not ensure vim (${(r.stderr || r.stdout || '').trim().slice(0, 160)})`,
        );
      }
    }),
  );
}

/** Delete any previous cluster and start a fresh spark-N. Resolves once pods are Ready. */
async function recreate(
  ns: string,
  challengeId: string,
  shape: SparkShape = 'spark-3',
  onPhase?: (message: string) => void,
  opts: { daemonMode?: DaemonMode } = {},
): Promise<void> {
  const daemonMode: DaemonMode = opts.daemonMode === 'manual' ? 'manual' : 'auto';
  const capacity = require('./k8sCapacity');
  if (!(await capacity.poolUp(POOL))) {
    throw Object.assign(
      new Error(
        'The machines that run these labs are offline right now, so your lab could not start. '
        + 'Please try again later, and contact the administrator if it keeps happening.',
      ),
      { status: 503, code: 'LAB_ENV_UNAVAILABLE' },
    );
  }
  const yarn = isYarnShape(shape);
  if (yarn) {
    onPhase?.('Creating your YARN cluster');
  } else if (daemonMode === 'manual') {
    onPhase?.('Procuring the nodes');
  } else {
    onPhase?.('Creating your cluster');
  }
  await ensureNamespace(ns);
  await deleteCluster(ns, true);
  if (yarn) {
    onPhase?.('Pulling the Spark-on-YARN image');
  } else if (daemonMode === 'manual') {
    onPhase?.('Installing Spark on the nodes');
  } else {
    onPhase?.('Pulling the Spark image');
  }
  await k8s.kubectlOk(['apply', '-f', '-'], {
    input: clusterYaml(ns, challengeId, shape, daemonMode),
    timeoutMs: 30_000,
  });
  if (yarn) {
    onPhase?.('Starting the ResourceManager');
  } else if (daemonMode !== 'manual') {
    onPhase?.('Starting the master');
  }
  const workers = workersFor(shape);
  const masterReady = await k8s.runKubectl(
    ['wait', '--for=condition=Ready', `pod/${MASTER}`, '-n', ns, `--timeout=${READY_TIMEOUT_S}s`],
    { timeoutMs: (READY_TIMEOUT_S + 20) * 1000 },
  );
  if (masterReady.code !== 0) {
    throw new Error(
      yarn
        ? `yarn ResourceManager host not ready after ${READY_TIMEOUT_S}s: ${await describeNotReady(ns)}`
        : `spark master not ready after ${READY_TIMEOUT_S}s: ${await describeNotReady(ns)}`,
    );
  }
  if (yarn) {
    onPhase?.('Starting the NodeManagers');
  } else if (daemonMode !== 'manual') {
    onPhase?.('Starting the workers');
  }
  const workerPods = workers.map((w) => `pod/${w.name}`);
  const workersReady = await k8s.runKubectl(
    ['wait', '--for=condition=Ready', ...workerPods, `pod/${SHELL}`, '-n', ns, `--timeout=${READY_TIMEOUT_S}s`],
    { timeoutMs: (READY_TIMEOUT_S + 20) * 1000 },
  );
  if (workersReady.code !== 0) {
    throw new Error(
      yarn
        ? `yarn NodeManager hosts not ready after ${READY_TIMEOUT_S}s: ${await describeNotReady(ns)}`
        : `spark workers not ready after ${READY_TIMEOUT_S}s: ${await describeNotReady(ns)}`,
    );
  }
  await ensureEditorsOnPods(ns, [MASTER, ...workers.map((w) => w.name), SHELL]);
  if (yarn) {
    onPhase?.('Using the cached Spark-on-YARN image');
  } else if (daemonMode !== 'manual') {
    onPhase?.('Using the cached Spark image');
  }
}

async function deletePod(ns: string): Promise<void> {
  await deleteCluster(ns, false);
}

/** Write investigation answers into ~/answers on the shell pod for grade.sh. */
async function writeInvestigationAnswers(
  ns: string,
  answers: Record<string, string>,
): Promise<void> {
  const lines = Object.entries(answers || {}).map(([key, value]) => {
    const safeKey = String(key).replace(/[^A-Za-z0-9._-]/g, '_');
    const safeVal = String(value ?? '').replace(/'/g, `'\\''`);
    return `printf '%s\\n' '${safeVal}' > "$HOME/answers/${safeKey}"`;
  });
  const script = [
    'mkdir -p "$HOME/answers"',
    'rm -f "$HOME/answers"/*',
    ...lines,
  ].join('\n');
  await k8s.kubectlOk(
    ['exec', '-n', ns, SHELL, '-c', SHELL, '--', 'bash', '-c', script],
    { timeoutMs: 30_000 },
  );
}

module.exports = {
  POD: SHELL,
  SHELL,
  MASTER,
  POOL,
  IMAGE,
  YARN_IMAGE,
  WORKER_UI_BASE,
  YARN_RM_UI_PORT,
  YARN_NM_UI_PORT,
  namespace,
  scriptEnv,
  shellExecArgs,
  resolveShellPod,
  recreate,
  deletePod,
  clusterYaml,
  masterUrl,
  masterUi,
  yarnRmUi,
  workersFor,
  isYarnShape,
  imageFor,
  writeInvestigationAnswers,
};
