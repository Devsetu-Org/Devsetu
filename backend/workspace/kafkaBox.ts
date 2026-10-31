'use strict';

/**
 * Kafka lab clusters: one pod per broker plus a shell pod, in kf-<user>, deleted
 * when the lab ends. Lab 01 uses shape kafka-3. The learner's terminal is bash
 * in the shell pod. They never get a kubeconfig.
 *
 * Brokers are the measured squeeze from deploy/eks/kafka/trial-kafka3.yaml:
 * 192 MB heap, SerialGC, 16 MB cleaner dedupe buffer. A kafka-3 lab requests
 * 832 Mi, so a t4g.medium holds three once the node allows 16 pods.
 *
 * Each broker has its own network namespace and advertises
 * kafka-N.kafka.<ns>.svc.cluster.local. The JVM resolves that name only as a
 * fully qualified name, so the short service name is not used. The headless
 * Service publishes addresses before a pod is Ready; otherwise the brokers
 * cannot find each other in order to become Ready. A ClusterIP would put all
 * three voters behind one address.
 */

const k8s = require('./k8sCluster');

const SHELL = 'shell';
/** Shell pod. Brokers are kafka-0, kafka-1, and kafka-2. */
const POD = SHELL;
const IMAGE = 'apache/kafka:3.9.1';
const POOL = 'kafka';
const CLUSTER_ID = '4L6g3nShT-eMCtK--X86sw';
const CLUSTER_DOMAIN = 'cluster.local';
const SERVICE = 'kafka';
const LAB_LABEL = 'app=kafka-lab';
const READY_TIMEOUT_S = 360;
const DELETE_GRACE_S = '5';
/** Pod clock includes image pull. The lab clock is 45 minutes and starts later. */
const ACTIVE_DEADLINE_S = 90 * 60;

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

function quorum(ns: string): string {
  return BROKERS.map((b) => `${b.id}@${brokerFqdn(b.name, ns)}:9093`).join(',');
}

function bootstrapServers(ns: string): string {
  return BROKERS.map((b) => `${brokerFqdn(b.name, ns)}:9092`).join(',');
}

function scriptEnv(ns: string): Record<string, string> {
  if (!ns) throw new Error('kafka scriptEnv requires the learner namespace');
  return {
    KAFKA_POD: SHELL,
    SHELL_CONTAINER: SHELL,
    BOOTSTRAP_SERVERS: bootstrapServers(ns),
  };
}

const EXIT_NOTICE = 'This cluster stays. Submit to solve the lab. Here is a fresh shell.';

function shellExecArgs(ns: string): string[] {
  const notice = EXIT_NOTICE.replace(/'/g, '');
  // `then` cannot be followed by `;`. The container already sets PATH,
  // BOOTSTRAP_SERVERS, KAFKA_HEAP_OPTS, and PS1; the inner shell inherits them.
  const relaunch =
    'while :; do if bash --noprofile --norc -i; then '
    + `printf '\\033[A\\033[2K\\r\\033[38;5;179m${notice}\\033[0m\\n'; `
    + 'else sleep 1; fi; done';
  return ['exec', '-it', '-n', ns, SHELL, '-c', SHELL, '--', 'bash', '-c', relaunch];
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

function brokerEnv(ns: string, b: typeof BROKERS[number]): string {
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
    ['KAFKA_HEAP_OPTS', '-Xms192m -Xmx192m'],
    ['KAFKA_JVM_PERFORMANCE_OPTS', '-server -XX:+UseSerialGC -XX:MaxMetaspaceSize=64m -Xss256k'],
  ];
  return rows.map(([name, value]) => `        - {name: ${name}, value: "${value}"}`).join('\n');
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

function podLabels(challengeId: string, component: string): string {
  return `    app.kubernetes.io/managed-by: devlabs
    app: kafka-lab
    component: ${component}
    shape: kafka-3
    ${k8s.CHALLENGE_LABEL}: ${labelValue(challengeId)}`;
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

function brokerPod(ns: string, challengeId: string, b: typeof BROKERS[number]): string {
  return `
apiVersion: v1
kind: Pod
metadata:
  name: ${b.name}
  namespace: ${ns}
  labels:
${podLabels(challengeId, 'broker')}
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
      env:
${brokerEnv(ns, b)}
      readinessProbe:
        exec:
          command: ["bash", "-c", "echo >/dev/tcp/127.0.0.1/9092"]
        initialDelaySeconds: 10
        periodSeconds: 5
        timeoutSeconds: 3
        failureThreshold: 36
      volumeMounts:
        - {name: data, mountPath: /var/lib/kafka/data}
      resources:
        requests: {cpu: 50m, memory: 256Mi}
        limits: {cpu: 500m, memory: 384Mi}
  volumes:
    - name: data
      emptyDir: {sizeLimit: 1Gi}
`;
}

function shellPod(ns: string, challengeId: string): string {
  return `
apiVersion: v1
kind: Pod
metadata:
  name: ${SHELL}
  namespace: ${ns}
  labels:
${podLabels(challengeId, 'shell')}
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
        - {name: BOOTSTRAP_SERVERS, value: "${bootstrapServers(ns)}"}
        - {name: KAFKA_HEAP_OPTS, value: "-Xms64m -Xmx64m"}
        # G1 is the image default and is slow to start. SerialGC plus C1-only
        # compilation is for this short-lived CLI, not the brokers.
        - {name: KAFKA_JVM_PERFORMANCE_OPTS, value: "-server -XX:+UseSerialGC -XX:TieredStopAtLevel=1 -XX:MaxInlineLevel=15 -Djava.awt.headless=true"}
        - {name: PS1, value: "kafka $ "}
      resources:
        requests: {cpu: 25m, memory: 64Mi}
        # A kafka-*.sh run is one JVM. At 500m that startup is throttled to about
        # twice its CPU time. One core lets a command finish in about a second and a half.
        limits: {cpu: "1", memory: 256Mi}
`;
}

function clusterYaml(ns: string, challengeId: string): string {
  return [
    serviceYaml(ns),
    ...BROKERS.map((b) => brokerPod(ns, challengeId, b)),
    shellPod(ns, challengeId),
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

/** Delete the brokers, the shell, and the headless Service. Also removes a lab
 * that was still the old single pod (it carries the same app label). */
async function deleteCluster(ns: string, wait: boolean): Promise<void> {
  const timeout = wait ? '90s' : '30s';
  await k8s.kubectlOk(
    ['delete', 'pod', '-n', ns, '-l', LAB_LABEL, '--ignore-not-found',
      `--grace-period=${DELETE_GRACE_S}`, `--wait=${wait}`, `--timeout=${timeout}`],
    { timeoutMs: wait ? 120_000 : 30_000 },
  );
  await k8s.kubectlOk(
    ['delete', 'service', SERVICE, '-n', ns, '--ignore-not-found', '--wait=false'],
    { timeoutMs: 15_000 },
  );
}

/** Delete any previous cluster and start a fresh kafka-3. Resolves once every broker is Ready. */
async function recreate(
  ns: string,
  challengeId: string,
  onPhase?: (message: string) => void,
): Promise<void> {
  // Last guard: never apply pods when the kafka pool has no Ready node.
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
  onPhase?.('Creating your machine');
  await ensureNamespace(ns);
  await deleteCluster(ns, true);
  await k8s.kubectlOk(['apply', '-f', '-'], {
    input: clusterYaml(ns, challengeId),
    timeoutMs: 30_000,
  });
  onPhase?.('Waiting for your machine to start');
  const pods = [...BROKERS.map((b) => `pod/${b.name}`), `pod/${SHELL}`];
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

module.exports = {
  POD,
  SHELL,
  POOL,
  namespace,
  scriptEnv,
  shellExecArgs,
  recreate,
  deletePod,
  clusterYaml,
  bootstrapServers,
};
