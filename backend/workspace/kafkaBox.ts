'use strict';

/**
 * Kafka lab clusters: one pod per broker (+ optional ZooKeeper) plus a shell
 * pod, in kf-<user>, deleted when the lab ends. The learner's terminal is bash
 * in the chosen pod. They never get a kubeconfig.
 *
 * Shapes:
 *   kafka-3     — KRaft combined brokers (Chapter 2+)
 *   kafka-zk-3  — ZooKeeper + three classic brokers (Lab 1 foundations)
 *
 * Sized for 2 labs per t4g.medium. Brokers: 256 MB heap, SerialGC, 16 MB
 * cleaner dedupe buffer. kafka-3 ≈ 1.28 Gi request; kafka-zk-3 ≈ 1.4 Gi.
 *
 * Each broker advertises kafka-N.kafka.<ns>.svc.cluster.local. The headless
 * Service publishes addresses before Ready so brokers can find each other.
 */

const k8s = require('./k8sCluster');

const SHELL = 'shell';
const ZK = 'zookeeper';
/** Shell pod. Brokers are kafka-0, kafka-1, and kafka-2. */
const POD = SHELL;
const IMAGE = 'apache/kafka:3.9.1';
const ZK_IMAGE = 'zookeeper:3.9';
const POOL = 'kafka';
const CLUSTER_ID = '4L6g3nShT-eMCtK--X86sw';
const CLUSTER_DOMAIN = 'cluster.local';
const SERVICE = 'kafka';
const ZK_SERVICE = 'zookeeper';
const LAB_LABEL = 'app=kafka-lab';
const READY_TIMEOUT_S = 360;
const DELETE_GRACE_S = '5';
/** Pod clock includes image pull. The lab clock is 45 minutes and starts later. */
const ACTIVE_DEADLINE_S = 90 * 60;

type KafkaShape = 'kafka-3' | 'kafka-zk-3';

const BROKERS = [
  { name: 'kafka-0', id: '1' },
  { name: 'kafka-1', id: '2' },
  { name: 'kafka-2', id: '3' },
];

function namespace(userName: string): string {
  return String(k8s.learnerNamespace(userName)).replace(/^ns-/, 'kf-');
}

function labelValue(raw: string): string {
  return raw.replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 63).replace(/[^A-Za-z0-9]+$/, '') || 'lab';
}

function brokerFqdn(name: string, ns: string): string {
  return `${name}.${SERVICE}.${ns}.svc.${CLUSTER_DOMAIN}`;
}

function zkHost(ns: string): string {
  return `${ZK_SERVICE}.${ns}.svc.${CLUSTER_DOMAIN}`;
}

function quorum(ns: string): string {
  return BROKERS.map((b) => `${b.id}@${brokerFqdn(b.name, ns)}:9093`).join(',');
}

function bootstrapServers(ns: string): string {
  return BROKERS.map((b) => `${brokerFqdn(b.name, ns)}:9092`).join(',');
}

function shapeOf(challengeId: string): KafkaShape {
  const loader = require('../challenges/loader');
  const shape = String(
    (loader.getChallenge(challengeId)?.k8sPlatform as { shape?: string } | null | undefined)?.shape
      || 'kafka-3',
  );
  return shape === 'kafka-zk-3' ? 'kafka-zk-3' : 'kafka-3';
}

function scriptEnv(ns: string, challengeId?: string): Record<string, string> {
  if (!ns) throw new Error('kafka scriptEnv requires the learner namespace');
  const env: Record<string, string> = {
    KAFKA_POD: SHELL,
    SHELL_CONTAINER: SHELL,
    BOOTSTRAP_SERVERS: bootstrapServers(ns),
  };
  if (challengeId && shapeOf(challengeId) === 'kafka-zk-3') {
    env.ZOOKEEPER_CONNECT = `${zkHost(ns)}:2181`;
    env.KAFKA_SHAPE = 'kafka-zk-3';
  } else {
    env.KAFKA_SHAPE = 'kafka-3';
  }
  return env;
}

const EXIT_NOTICE = 'This cluster stays. Submit to solve the lab. Here is a fresh shell.';

/** Allowed terminal targets: shell, brokers, and zookeeper when present. */
function resolveShellPod(node: string | null | undefined): { pod: string; container: string } {
  const raw = String(node || SHELL).trim();
  const allowed = new Set<string>([SHELL, ZK, ...BROKERS.map((b) => b.name)]);
  const pod = allowed.has(raw) ? raw : SHELL;
  return { pod, container: pod };
}

function shellExecArgs(ns: string, node?: string | null): string[] {
  const { pod, container } = resolveShellPod(node);
  const notice = EXIT_NOTICE.replace(/'/g, '');
  const onShell = pod === SHELL;
  const onZk = pod === ZK;
  let envPrefix = '';
  if (onZk) {
    envPrefix =
      'export PATH="/opt/java/openjdk/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/apache-zookeeper-3.9.7-bin/bin"; '
      + 'export PS1="zk $ "; ';
  } else if (!onShell) {
    envPrefix =
      'export PATH="/tmp/lab-bin:/opt/kafka/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"; '
      + 'export PS1="kafka $ "; ';
  }
  const relaunch =
    `while :; do if ${envPrefix}bash --noprofile --norc -i; then `
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
    app.kubernetes.io/component: kafka-lab
    pod-security.kubernetes.io/enforce: baseline
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: dl-kafka-isolation
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
                app: kafka-lab
  tolerations:
    - key: devlabs.io/pool
      value: ${POOL}
      effect: NoSchedule`;
}

function podLabels(challengeId: string, component: string, shape: KafkaShape): string {
  return `    app.kubernetes.io/managed-by: devlabs
    app: kafka-lab
    component: ${component}
    shape: ${shape}
    ${k8s.CHALLENGE_LABEL}: ${labelValue(challengeId)}`;
}

function kraftBrokerEnv(ns: string, b: typeof BROKERS[number]): string {
  const host = brokerFqdn(b.name, ns);
  const rows: Array<[string, string]> = [
    ['KAFKA_NODE_ID', b.id],
    ['KAFKA_LISTENERS', 'PLAINTEXT://0.0.0.0:9092,CONTROLLER://0.0.0.0:9093'],
    ['KAFKA_ADVERTISED_LISTENERS', `PLAINTEXT://${host}:9092`],
    ['CLUSTER_ID', CLUSTER_ID],
    ['KAFKA_PROCESS_ROLES', 'broker,controller'],
    ['KAFKA_LISTENER_SECURITY_PROTOCOL_MAP', 'CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT'],
    ['KAFKA_INTER_BROKER_LISTENER_NAME', 'PLAINTEXT'],
    ['KAFKA_CONTROLLER_LISTENER_NAMES', 'CONTROLLER'],
    ['KAFKA_CONTROLLER_QUORUM_VOTERS', quorum(ns)],
    ['KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR', '3'],
    ['KAFKA_OFFSETS_TOPIC_NUM_PARTITIONS', '3'],
    ['KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR', '3'],
    ['KAFKA_TRANSACTION_STATE_LOG_MIN_ISR', '2'],
    ['KAFKA_DEFAULT_REPLICATION_FACTOR', '3'],
    ['KAFKA_MIN_INSYNC_REPLICAS', '2'],
    ['KAFKA_GROUP_INITIAL_REBALANCE_DELAY_MS', '0'],
    ['KAFKA_NUM_NETWORK_THREADS', '2'],
    ['KAFKA_NUM_IO_THREADS', '2'],
    ['KAFKA_NUM_REPLICA_FETCHERS', '1'],
    ['KAFKA_LOG_CLEANER_THREADS', '1'],
    ['KAFKA_LOG_CLEANER_DEDUPE_BUFFER_SIZE', '16777216'],
    ['KAFKA_AUTO_CREATE_TOPICS_ENABLE', 'false'],
    ['KAFKA_DELETE_TOPIC_ENABLE', 'true'],
    ['KAFKA_LOG_DIRS', '/var/lib/kafka/data'],
    ['KAFKA_HEAP_OPTS', '-Xms256m -Xmx256m'],
    ['KAFKA_JVM_PERFORMANCE_OPTS', '-server -XX:+UseSerialGC -XX:MaxMetaspaceSize=64m -Xss256k'],
  ];
  return rows.map(([name, value]) => `        - {name: ${name}, value: "${value}"}`).join('\n');
}

function serviceYaml(ns: string): string {
  return `
apiVersion: v1
kind: Service
metadata:
  name: ${SERVICE}
  namespace: ${ns}
  labels:
    app.kubernetes.io/managed-by: devlabs
    app: kafka-lab
spec:
  clusterIP: None
  publishNotReadyAddresses: true
  selector:
    app: kafka-lab
    component: broker
  ports:
    - {name: client, port: 9092, targetPort: 9092}
    - {name: controller, port: 9093, targetPort: 9093}
`;
}

function zkServiceYaml(ns: string): string {
  return `
apiVersion: v1
kind: Service
metadata:
  name: ${ZK_SERVICE}
  namespace: ${ns}
  labels:
    app.kubernetes.io/managed-by: devlabs
    app: kafka-lab
spec:
  clusterIP: None
  publishNotReadyAddresses: true
  selector:
    app: kafka-lab
    component: zookeeper
  ports:
    - {name: client, port: 2181, targetPort: 2181}
`;
}

function zkPod(ns: string, challengeId: string): string {
  return `
apiVersion: v1
kind: Pod
metadata:
  name: ${ZK}
  namespace: ${ns}
  labels:
${podLabels(challengeId, 'zookeeper', 'kafka-zk-3')}
  annotations:
    karpenter.sh/do-not-disrupt: "true"
spec:
  hostname: ${ZK}
  subdomain: ${ZK_SERVICE}
${podScheduling()}
  containers:
    - name: ${ZK}
      image: ${ZK_IMAGE}
      imagePullPolicy: IfNotPresent
      env:
        - {name: ZOO_4LW_COMMANDS_WHITELIST, value: "*"}
        - {name: ZOO_DATA_DIR, value: "/data"}
      readinessProbe:
        exec:
          command:
            - "bash"
            - "-c"
            - "exec 3<>/dev/tcp/127.0.0.1/2181; printf 'ruok' >&3; grep -q imok <&3"
        initialDelaySeconds: 5
        periodSeconds: 5
        timeoutSeconds: 3
        failureThreshold: 36
      volumeMounts:
        - {name: data, mountPath: /data}
        - {name: datalog, mountPath: /datalog}
      resources:
        requests: {cpu: 50m, memory: 128Mi}
        limits: {cpu: 250m, memory: 256Mi}
  volumes:
    - name: data
      emptyDir: {sizeLimit: 256Mi}
    - name: datalog
      emptyDir: {sizeLimit: 256Mi}
`;
}

/** Labs that need a tiny log dir on kafka-1 to plant disk-full. */
function brokerDataLimit(challengeId: string, brokerName: string): string {
  const tight = new Set([
    'kafka-07-segments-retention-and-why-disk-fills',
    'kafka-08-capstone-disk-isr-and-the-write-path',
  ]);
  if (tight.has(challengeId) && brokerName === 'kafka-1') return '64Mi';
  return '1Gi';
}

/**
 * Supervisor so learners can stop/start a broker without the pod exiting:
 *   qb-broker stop|start   (on that broker host)
 * State file: /var/lib/kafka/data/.lab-broker-wanted  (run|stop)
 */
function kraftBrokerStartScript(): string {
  return [
    'set -euo pipefail',
    // Keep helpers OUT of log.dirs — Kafka rejects unknown children there.
    'STATE=/tmp/.lab-broker-wanted',
    'BIN=/tmp/lab-bin',
    'mkdir -p /var/lib/kafka/data "$BIN"',
    'export PATH="$BIN:/opt/kafka/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"',
    '[[ -f "$STATE" ]] || printf "run\\n" > "$STATE"',
    'cat > "$BIN/qb-broker" <<\'QB\'',
    '#!/bin/bash',
    'set -euo pipefail',
    'STATE=/tmp/.lab-broker-wanted',
    'cmd=${1:-}',
    'case "$cmd" in',
    '  stop) printf "stop\\n" > "$STATE"; echo "broker will stop";;',
    '  start) printf "run\\n" > "$STATE"; echo "broker will start";;',
    '  status) tr -d "[:space:]" < "$STATE"; echo;;',
    '  *) echo "usage: qb-broker stop|start|status" >&2; exit 2;;',
    'esac',
    'QB',
    'chmod +x "$BIN/qb-broker"',
    // Prefer image docker launcher; fall back to kafka-server-start if layout differs.
    'start_kafka() {',
    '  if [[ -x /etc/kafka/docker/run ]]; then',
    '    /etc/kafka/docker/run',
    '  else',
    '    /opt/kafka/bin/kafka-server-start.sh /opt/kafka/config/server.properties',
    '  fi',
    '}',
    'stop_kafka() {',
    '  # docker/run spawns children — kill the tree, not just the parent pid.',
    '  pkill -f "kafka.Kafka|/etc/kafka/docker/run|kafka-server-start" 2>/dev/null || true',
    '  sleep 1',
    '  pkill -9 -f "kafka.Kafka|/etc/kafka/docker/run|kafka-server-start" 2>/dev/null || true',
    '}',
    'while true; do',
    '  want=$(tr -d "[:space:]" < "$STATE" 2>/dev/null || echo run)',
    '  if [[ "$want" != "run" ]]; then',
    '    stop_kafka',
    '    sleep 2',
    '    continue',
    '  fi',
    '  # Already running?',
    '  if pgrep -f "kafka.Kafka" >/dev/null 2>&1; then',
    '    sleep 2',
    '    continue',
    '  fi',
    '  start_kafka &',
    '  pid=$!',
    '  while kill -0 "$pid" 2>/dev/null; do',
    '    want=$(tr -d "[:space:]" < "$STATE" 2>/dev/null || echo run)',
    '    if [[ "$want" != "run" ]]; then',
    '      stop_kafka',
    '      wait "$pid" 2>/dev/null || true',
    '      break',
    '    fi',
    '    sleep 2',
    '  done',
    '  wait "$pid" 2>/dev/null || true',
    '  sleep 2',
    'done',
  ].join('\n');
}

function kraftBrokerPod(ns: string, challengeId: string, b: typeof BROKERS[number]): string {
  const b64 = Buffer.from(kraftBrokerStartScript(), 'utf8').toString('base64');
  const dataLimit = brokerDataLimit(challengeId, b.name);
  return `
apiVersion: v1
kind: Pod
metadata:
  name: ${b.name}
  namespace: ${ns}
  labels:
${podLabels(challengeId, 'broker', 'kafka-3')}
  annotations:
    karpenter.sh/do-not-disrupt: "true"
spec:
  hostname: ${b.name}
  subdomain: ${SERVICE}
${podScheduling()}
  containers:
    - name: ${b.name}
      image: ${IMAGE}
      imagePullPolicy: IfNotPresent
      command: ["/bin/bash", "-c"]
      args: ["echo ${b64} | base64 -d | bash"]
      env:
${kraftBrokerEnv(ns, b)}
      readinessProbe:
        exec:
          command: ["bash", "-c", "echo >/dev/tcp/127.0.0.1/9092"]
        initialDelaySeconds: 15
        periodSeconds: 5
        timeoutSeconds: 3
        failureThreshold: 48
      volumeMounts:
        - {name: data, mountPath: /var/lib/kafka/data}
      resources:
        requests: {cpu: 100m, memory: 384Mi}
        limits: {cpu: 500m, memory: 512Mi}
  volumes:
    - name: data
      emptyDir: {sizeLimit: ${dataLimit}}
`;
}

/** Classic ZK broker: apache/kafka image with kafka-server-start + server.properties. */
function zkBrokerPod(ns: string, challengeId: string, b: typeof BROKERS[number]): string {
  const host = brokerFqdn(b.name, ns);
  const zk = `${zkHost(ns)}:2181`;
  // Single-quoted heredoc body; values expanded by the outer template carefully.
  const startScript = [
    'set -euo pipefail',
    'mkdir -p /var/lib/kafka/data',
    'cat > /tmp/server.properties <<EOF',
    `broker.id=${b.id}`,
    'listeners=PLAINTEXT://0.0.0.0:9092',
    `advertised.listeners=PLAINTEXT://${host}:9092`,
    `zookeeper.connect=${zk}`,
    'log.dirs=/var/lib/kafka/data',
    'num.network.threads=2',
    'num.io.threads=2',
    'num.replica.fetchers=1',
    'log.cleaner.threads=1',
    'log.cleaner.dedupe.buffer.size=16777216',
    'offsets.topic.replication.factor=3',
    'offsets.topic.num.partitions=3',
    'transaction.state.log.replication.factor=3',
    'transaction.state.log.min.isr=2',
    'default.replication.factor=3',
    'min.insync.replicas=2',
    'group.initial.rebalance.delay.ms=0',
    'auto.create.topics.enable=false',
    'delete.topic.enable=true',
    'EOF',
    'export KAFKA_HEAP_OPTS="-Xms256m -Xmx256m"',
    'export KAFKA_JVM_PERFORMANCE_OPTS="-server -XX:+UseSerialGC -XX:MaxMetaspaceSize=64m -Xss256k"',
    // So learners can find log.dirs the same way as KRaft labs (process environ).
    'export KAFKA_LOG_DIRS=/var/lib/kafka/data',
    'export KAFKA_ZOOKEEPER_CONNECT=' + zk,
    'exec /opt/kafka/bin/kafka-server-start.sh /tmp/server.properties',
  ].join('\n');
  const b64 = Buffer.from(startScript, 'utf8').toString('base64');
  return `
apiVersion: v1
kind: Pod
metadata:
  name: ${b.name}
  namespace: ${ns}
  labels:
${podLabels(challengeId, 'broker', 'kafka-zk-3')}
  annotations:
    karpenter.sh/do-not-disrupt: "true"
spec:
  hostname: ${b.name}
  subdomain: ${SERVICE}
${podScheduling()}
  containers:
    - name: ${b.name}
      image: ${IMAGE}
      imagePullPolicy: IfNotPresent
      command: ["/bin/bash", "-c"]
      args: ["echo ${b64} | base64 -d | bash"]
      readinessProbe:
        exec:
          command: ["bash", "-c", "echo >/dev/tcp/127.0.0.1/9092"]
        initialDelaySeconds: 15
        periodSeconds: 5
        timeoutSeconds: 3
        failureThreshold: 48
      volumeMounts:
        - {name: data, mountPath: /var/lib/kafka/data}
      resources:
        requests: {cpu: 100m, memory: 384Mi}
        limits: {cpu: 500m, memory: 512Mi}
  volumes:
    - name: data
      emptyDir: {sizeLimit: 1Gi}
`;
}

function shellPod(ns: string, challengeId: string, shape: KafkaShape): string {
  const zkConnect = shape === 'kafka-zk-3' ? `${zkHost(ns)}:2181` : '';
  const zkEnv = shape === 'kafka-zk-3'
    ? `\n        - {name: ZOOKEEPER_CONNECT, value: "${zkConnect}"}`
    : '';
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
${podScheduling()}
  containers:
    - name: ${SHELL}
      image: ${IMAGE}
      imagePullPolicy: IfNotPresent
      command: ["/bin/sleep", "infinity"]
      workingDir: /tmp
      env:
        - {name: PATH, value: "/opt/kafka/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"}
        - {name: HOME, value: "/tmp"}
        - {name: BOOTSTRAP_SERVERS, value: "${bootstrapServers(ns)}"}
        - {name: KAFKA_HEAP_OPTS, value: "-Xms64m -Xmx64m"}
        - {name: KAFKA_JVM_PERFORMANCE_OPTS, value: "-server -XX:+UseSerialGC -XX:TieredStopAtLevel=1 -XX:MaxInlineLevel=15 -Djava.awt.headless=true"}
        - {name: PS1, value: "kafka $ "}${zkEnv}
      resources:
        requests: {cpu: 50m, memory: 128Mi}
        limits: {cpu: "1", memory: 512Mi}
`;
}

function clusterYaml(ns: string, challengeId: string, shape?: KafkaShape): string {
  const s = shape || shapeOf(challengeId);
  if (s === 'kafka-zk-3') {
    return [
      zkServiceYaml(ns),
      serviceYaml(ns),
      zkPod(ns, challengeId),
      ...BROKERS.map((b) => zkBrokerPod(ns, challengeId, b)),
      shellPod(ns, challengeId, s),
    ].join('---\n');
  }
  return [
    serviceYaml(ns),
    ...BROKERS.map((b) => kraftBrokerPod(ns, challengeId, b)),
    shellPod(ns, challengeId, s),
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

/** Delete brokers, ZooKeeper, shell, and Services. */
async function deleteCluster(ns: string, wait: boolean): Promise<void> {
  const timeout = wait ? '90s' : '30s';
  await k8s.kubectlOk(
    ['delete', 'pod', '-n', ns, '-l', LAB_LABEL, '--ignore-not-found',
      `--grace-period=${DELETE_GRACE_S}`, `--wait=${wait}`, `--timeout=${timeout}`],
    { timeoutMs: wait ? 120_000 : 30_000 },
  );
  await k8s.kubectlOk(
    ['delete', 'service', SERVICE, ZK_SERVICE, '-n', ns, '--ignore-not-found', '--wait=false'],
    { timeoutMs: 15_000 },
  );
}

/** Delete any previous cluster and start a fresh shape for this challenge. */
async function recreate(
  ns: string,
  challengeId: string,
  onPhase?: (message: string) => void,
): Promise<void> {
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
  const shape = shapeOf(challengeId);
  onPhase?.('Creating your machine');
  await ensureNamespace(ns);
  await deleteCluster(ns, true);
  await k8s.kubectlOk(['apply', '-f', '-'], {
    input: clusterYaml(ns, challengeId, shape),
    timeoutMs: 30_000,
  });
  onPhase?.('Waiting for your machine to start');
  const pods = shape === 'kafka-zk-3'
    ? [`pod/${ZK}`, ...BROKERS.map((b) => `pod/${b.name}`), `pod/${SHELL}`]
    : [...BROKERS.map((b) => `pod/${b.name}`), `pod/${SHELL}`];
  const ready = await k8s.runKubectl(
    ['wait', '--for=condition=Ready', ...pods, '-n', ns, `--timeout=${READY_TIMEOUT_S}s`],
    { timeoutMs: (READY_TIMEOUT_S + 20) * 1000 },
  );
  if (ready.code !== 0) {
    throw new Error(`kafka cluster not ready after ${READY_TIMEOUT_S}s: ${await describeNotReady(ns)}`);
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
  POD,
  SHELL,
  ZK,
  POOL,
  IMAGE,
  ZK_IMAGE,
  BROKERS,
  CLUSTER_ID,
  namespace,
  scriptEnv,
  shellExecArgs,
  resolveShellPod,
  recreate,
  deletePod,
  clusterYaml,
  bootstrapServers,
  shapeOf,
  writeInvestigationAnswers,
};
