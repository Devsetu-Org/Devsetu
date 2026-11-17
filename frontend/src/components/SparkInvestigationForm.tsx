import React, { useMemo, useState } from 'react';

export type SparkInvestigationField = {
  key: string;
  label: string;
  hint?: string;
  section: string;
  /** When set, the field is a dropdown; value stored is the option `id`. */
  options?: Array<{ id: string; label: string }>;
};

/** Optional paced UI — one page at a time. Grade keys stay the same. */
export type SparkInvestigationStep = {
  id: string;
  title: string;
  blurb?: string;
  /** Field keys on this page (order preserved). */
  fieldKeys: string[];
};

export type SparkInvestigationSpec = {
  intro: string;
  fields: SparkInvestigationField[];
  /** When set, Investigation renders as a short wizard instead of one long form. */
  steps?: SparkInvestigationStep[];
};

/**
 * Chapter 1 foundations — Investigation tab captures what you found before Submit.
 * Graders later read these keys via ~/answers on the shell pod.
 */
const SPARK_INVESTIGATIONS: Record<string, SparkInvestigationSpec> = {
  'kafka-05-under-replicated-is-not-a-failed-write': {
    intro: 'Restore the missing broker and wait for ISR — do not lower min.ISR.',
    steps: [
      {
        id: 'fix',
        title: 'Fix',
        blurb: 'How you cleared URP, and which shortcut you refused.',
        fieldKeys: ['howFixed', 'refusedShortcut'],
      },
    ],
    fields: [
      {
        section: 'Fix',
        key: 'howFixed',
        label: 'How did you clear under-replicated partitions?',
        options: [
          { id: 'start-broker-wait-isr', label: 'Started kafka-2 and waited for ISR=3' },
          { id: 'force-election', label: 'Forced a preferred leader election' },
          { id: 'drop-minisr', label: 'Set min.insync.replicas=1' },
        ],
      },
      {
        section: 'Fix',
        key: 'refusedShortcut',
        label: 'Which shortcut did you refuse?',
        options: [
          { id: 'left-minisr', label: 'Left min.insync.replicas at 2' },
          { id: 'used-minisr-1', label: 'Dropped min.ISR to 1' },
          { id: 'enabled-unclean', label: 'Enabled unclean leader election' },
        ],
      },
    ],
  },
  'kafka-06-min-isr-is-why-produces-fail': {
    intro: 'Restore RF and the broker. Do not drop min.ISR to make the page green.',
    steps: [
      {
        id: 'fix',
        title: 'Fix',
        fieldKeys: ['howFixed', 'refusedShortcut'],
      },
    ],
    fields: [
      {
        section: 'Fix',
        key: 'howFixed',
        label: 'How did you fix produces?',
        options: [
          { id: 'restore-rf-and-broker', label: 'Started the broker and restored RF=3 with min.ISR=2' },
          { id: 'drop-minisr', label: 'Set min.insync.replicas=1' },
          { id: 'unclean', label: 'Enabled unclean leader election' },
        ],
      },
      {
        section: 'Fix',
        key: 'refusedShortcut',
        label: 'Which shortcut did you refuse?',
        options: [
          { id: 'left-minisr', label: 'Refused min.ISR=1; left durability intact' },
          { id: 'used-minisr-1', label: 'Set min.ISR=1' },
          { id: 'enabled-unclean', label: 'Enabled unclean election' },
        ],
      },
    ],
  },
  'kafka-07-segments-retention-and-why-disk-fills': {
    intro: 'Free disk without touching the hot path. Know delete vs compact.',
    steps: [
      {
        id: 'lesson',
        title: 'Retention lesson',
        fieldKeys: ['cleanupLesson'],
      },
    ],
    fields: [
      {
        section: 'Retention lesson',
        key: 'cleanupLesson',
        label: 'delete vs compact — which is true?',
        options: [
          {
            id: 'delete-vs-compact',
            label: 'delete drops old segments by time/size; compact keeps latest per key — you cannot un-delete compaction',
          },
          { id: 'same-thing', label: 'delete and compact are the same' },
          { id: 'compact-restores', label: 'compaction can restore deleted history' },
        ],
      },
    ],
  },
  'kafka-08-capstone-disk-isr-and-the-write-path': {
    intro: 'Free disk, drain lag by reading, refuse the ticket shortcuts.',
    steps: [
      {
        id: 'fix',
        title: 'Fix',
        fieldKeys: ['howFixed', 'refusedShortcut'],
      },
    ],
    fields: [
      {
        section: 'Fix',
        key: 'howFixed',
        label: 'How did you clear the page?',
        options: [
          { id: 'free-disk-read-forward', label: 'Freed disk and let dispatch-desk read forward' },
          { id: 'reset-latest', label: 'Reset the group to latest' },
          { id: 'drop-minisr', label: 'Set min.ISR=1' },
        ],
      },
      {
        section: 'Fix',
        key: 'refusedShortcut',
        label: 'Which shortcut did you refuse?',
        options: [
          { id: 'no-reset-latest', label: 'Refused reset-offsets --to-latest' },
          { id: 'used-latest', label: 'Reset to latest' },
          { id: 'unclean', label: 'Enabled unclean election' },
        ],
      },
    ],
  },
  'kafka-04-the-partition-and-replica-map': {
    intro:
      'Study rider.dispatch as a diagram — no brokers down. Answers save as you go — Incomplete Investigation still fails on Submit.',
    steps: [
      {
        id: 'shape',
        title: 'Topic shape',
        blurb: 'Partitions, RF, min.ISR, unclean election.',
        fieldKeys: ['partitions', 'rf', 'minIsr', 'uncleanElection'],
      },
      {
        id: 'p0',
        title: 'Partition 0',
        blurb: 'Leader, preferred replica, and ISR.',
        fieldKeys: ['p0Leader', 'p0Preferred', 'p0Isr'],
      },
      {
        id: 'predict',
        title: 'Predictions',
        blurb: 'One broker dies — do acks=all produces still succeed?',
        fieldKeys: ['predictRf3Min2', 'predictRf3Min3', 'predictRf2Min2'],
      },
    ],
    fields: [
      { section: 'Topic shape', key: 'partitions', label: 'Partition count' },
      { section: 'Topic shape', key: 'rf', label: 'Replication factor' },
      { section: 'Topic shape', key: 'minIsr', label: 'min.insync.replicas' },
      {
        section: 'Topic shape',
        key: 'uncleanElection',
        label: 'unclean.leader.election.enable',
        options: [
          { id: 'false', label: 'false (default / durable)' },
          { id: 'true', label: 'true (out-of-ISR leaders allowed)' },
        ],
      },
      { section: 'Partition 0', key: 'p0Leader', label: 'Leader broker id' },
      {
        section: 'Partition 0',
        key: 'p0Preferred',
        label: 'Preferred leader (first Replicas id)',
      },
      {
        section: 'Partition 0',
        key: 'p0Isr',
        label: 'ISR (comma-separated)',
        hint: 'Order does not matter.',
      },
      {
        section: 'Predictions',
        key: 'predictRf3Min2',
        label: 'RF=3, min.ISR=2 — one broker dies',
        options: [
          { id: 'still-ok', label: 'Produces still succeed (ISR can stay ≥ 2)' },
          { id: 'produces-fail', label: 'Produces fail' },
          { id: 'need-unclean', label: 'Must enable unclean election' },
        ],
      },
      {
        section: 'Predictions',
        key: 'predictRf3Min3',
        label: 'RF=3, min.ISR=3 — one broker dies',
        options: [
          { id: 'still-ok', label: 'Produces still succeed' },
          { id: 'produces-fail', label: 'Produces fail (ISR cannot stay at 3)' },
          { id: 'need-unclean', label: 'Must enable unclean election' },
        ],
      },
      {
        section: 'Predictions',
        key: 'predictRf2Min2',
        label: 'RF=2, min.ISR=2 — one broker dies',
        options: [
          { id: 'still-ok', label: 'Produces still succeed' },
          { id: 'produces-fail', label: 'Produces fail (ISR cannot stay at 2)' },
          { id: 'need-unclean', label: 'Must enable unclean election' },
        ],
      },
    ],
  },
  'kafka-03-trace-a-produce-from-client-to-last-replica': {
    intro:
      'Produce one keyed record into rider.dispatch, then walk these pages. Answers save as you go — Incomplete Investigation still fails on Submit.',
    steps: [
      {
        id: 'client',
        title: 'Client',
        blurb: 'What bootstrap list did you use, and which key did you produce?',
        fieldKeys: ['bootstrapSource', 'produceKey'],
      },
      {
        id: 'map',
        title: 'Partition map',
        blurb: 'Partition, leader broker id, and ISR for that record.',
        fieldKeys: ['partition', 'leaderId', 'isr'],
      },
      {
        id: 'end',
        title: 'Log end',
        blurb: 'Log-end offset for that partition after acks=all.',
        fieldKeys: ['logEndOffset'],
      },
    ],
    fields: [
      {
        section: 'Client',
        key: 'bootstrapSource',
        label: 'Which bootstrap list did the producer use?',
        options: [
          { id: 'env-bootstrap', label: '$BOOTSTRAP_SERVERS from the shell environment' },
          { id: 'localhost', label: 'localhost:9092 only' },
          { id: 'zk', label: 'ZooKeeper connect string' },
          { id: 'hardcoded-one', label: 'A single broker hostname typed from memory' },
        ],
      },
      {
        section: 'Client',
        key: 'produceKey',
        label: 'Record key',
        hint: 'From ~/ticket/PRODUCE.md',
      },
      {
        section: 'Partition map',
        key: 'partition',
        label: 'Partition id',
        hint: 'Which partition the key hashed to.',
      },
      {
        section: 'Partition map',
        key: 'leaderId',
        label: 'Leader broker id',
        hint: 'Numeric broker id from --describe (1 / 2 / 3).',
      },
      {
        section: 'Partition map',
        key: 'isr',
        label: 'ISR (broker ids)',
        hint: 'Comma-separated, e.g. 1,2,3 — order does not matter.',
      },
      {
        section: 'Log end',
        key: 'logEndOffset',
        label: 'Log-end offset',
        hint: 'From kafka-get-offsets.sh --time -1 for that partition.',
      },
    ],
  },
  'kafka-02-open-a-topic-the-platform-way': {
    intro:
      'This lab is KRaft. Create order.status to the platform shape, then walk these pages. Answers save as you go — Incomplete Investigation still fails on Submit.',
    steps: [
      {
        id: 'plane',
        title: 'Control plane',
        blurb: 'What elects the controller on this cluster?',
        fieldKeys: ['controlPlane'],
      },
      {
        id: 'source',
        title: 'Shape source',
        blurb: 'Ticket vs platform note — which one did you follow?',
        fieldKeys: ['shapeSource'],
      },
      {
        id: 'shape',
        title: 'order.status shape',
        blurb: 'The numbers you applied from the platform note.',
        fieldKeys: [
          'orderStatusPartitions',
          'orderStatusRf',
          'orderStatusRetention',
          'orderStatusMinIsr',
        ],
      },
    ],
    fields: [
      {
        section: 'Control plane',
        key: 'controlPlane',
        label: 'What is the control plane on this lab?',
        options: [
          { id: 'kraft', label: 'KRaft — combined broker + controller, no ZooKeeper' },
          { id: 'zookeeper', label: 'ZooKeeper — elects the controller; brokers are separate' },
          { id: 'etcd', label: 'etcd — same as Kubernetes' },
          { id: 'raft-only', label: 'A standalone Raft library with no ZK and no KRaft' },
        ],
      },
      {
        section: 'Shape source',
        key: 'shapeSource',
        label: 'Which file did you use for the order.status shape?',
        options: [
          { id: 'ticket', label: 'Trusted ~/ticket/TICKET.md (3 parts / RF 2 / min.ISR 1)' },
          { id: 'platform-note', label: 'Followed ~/ticket/PLATFORM.md (6 / 3 / 3-day / min.ISR 2)' },
          { id: 'guess', label: 'Guessed from another topic without reading either file' },
          { id: 'ui-only', label: 'Copied settings from a Kafka UI that is not on this lab' },
        ],
      },
      {
        section: 'order.status shape',
        key: 'orderStatusPartitions',
        label: 'Partitions',
        hint: 'From PLATFORM.md — not the ticket.',
      },
      {
        section: 'order.status shape',
        key: 'orderStatusRf',
        label: 'Replication factor',
      },
      {
        section: 'order.status shape',
        key: 'orderStatusRetention',
        label: 'retention.ms',
        hint: 'Exact millisecond value from the platform note.',
      },
      {
        section: 'order.status shape',
        key: 'orderStatusMinIsr',
        label: 'min.insync.replicas',
      },
    ],
  },
  'kafka-01-stand-up-the-cluster-and-find-everything-on-disk': {
    intro:
      'This lab is the ZooKeeper-era cluster. Confirm ZK + brokers, then walk these pages. Answers save as you go — Incomplete Investigation still fails on Submit.',
    steps: [
      {
        id: 'processes',
        title: 'Processes',
        blurb: 'PIDs from ps / jps on zookeeper and each broker.',
        fieldKeys: ['zkPid', 'broker0Pid', 'broker1Pid', 'broker2Pid'],
      },
      {
        id: 'on-disk',
        title: 'On disk',
        blurb: 'Real ZK dataDir and Kafka log.dirs — not the handoff decoys. Controller from /controller.',
        fieldKeys: ['zkDataDir', 'logDirs', 'controller'],
      },
      {
        id: 'how',
        title: 'How you found it',
        blurb: 'Source of truth for log.dirs, and which control plane this lab uses.',
        fieldKeys: ['logDirsSource', 'controlPlane'],
      },
    ],
    fields: [
      { section: 'Processes', key: 'zkPid', label: 'ZooKeeper PID', hint: 'PID of the ZooKeeper process on zookeeper.' },
      { section: 'Processes', key: 'broker0Pid', label: 'kafka-0 PID', hint: 'PID of the Kafka broker on kafka-0.' },
      { section: 'Processes', key: 'broker1Pid', label: 'kafka-1 PID', hint: 'PID of the Kafka broker on kafka-1.' },
      { section: 'Processes', key: 'broker2Pid', label: 'kafka-2 PID', hint: 'PID of the Kafka broker on kafka-2.' },
      {
        section: 'On disk',
        key: 'zkDataDir',
        label: 'ZooKeeper dataDir',
        hint: 'Live ZooKeeper data directory (look for myid) — not the handoff decoy.',
      },
      {
        section: 'On disk',
        key: 'logDirs',
        label: 'Broker log directory',
        hint: 'log.dirs used by the live broker process.',
      },
      {
        section: 'On disk',
        key: 'controller',
        label: 'Controller broker id',
        hint: 'brokerid from zookeeper-shell get /controller on the shell. Not kafka-metadata-quorum.',
      },
      {
        section: 'How you found it',
        key: 'logDirsSource',
        label: 'How did you find the real Kafka log directory?',
        hint: 'The handoff note is a claim. What confirmed the path?',
        options: [
          { id: 'handoff', label: 'Trusted ~/ticket/HANDOFF.md and used /opt/kafka/kafka-logs' },
          { id: 'guess-tmp', label: 'Guessed /tmp/kafka or /var/log/kafka' },
          { id: 'process-env', label: 'Read KAFKA_LOG_DIRS (or log.dirs) from the live process environment' },
          { id: 'ui-only', label: 'Read it from a Kafka UI that is not on this lab' },
        ],
      },
      {
        section: 'How you found it',
        key: 'controlPlane',
        label: 'What is the control plane on this lab?',
        options: [
          { id: 'kraft', label: 'KRaft — combined broker + controller, no ZooKeeper' },
          { id: 'zookeeper', label: 'ZooKeeper — elects the controller; brokers are separate' },
          { id: 'etcd', label: 'etcd — same as Kubernetes' },
          { id: 'raft-only', label: 'A standalone Raft library with no ZK and no KRaft' },
        ],
      },
    ],
  },
  'spark-01-stand-up-the-cluster-and-find-everything-on-disk': {
    intro:
      'Bring the cluster up from the Guide, then walk these pages. Answers save as you go — Incomplete Investigation still fails on Submit.',
    steps: [
      {
        id: 'processes',
        title: 'Processes',
        blurb: 'PIDs from ps / jps on each host after Master and both Workers are up.',
        fieldKeys: ['masterPidHint', 'worker0PidHint', 'worker1PidHint'],
      },
      {
        id: 'on-disk',
        title: 'On disk',
        blurb: 'Log, work, and conf directories on the Master and a Worker — find them on the nodes.',
        fieldKeys: ['masterLogs', 'masterWork', 'masterConf', 'workerLogs', 'workerWork'],
      },
      {
        id: 'config',
        title: 'Config roles',
        blurb: 'Open the conf files, then pick what each one configures.',
        fieldKeys: ['sparkEnvRole', 'sparkDefaultsRole'],
      },
      {
        id: 'start-flow',
        title: 'Start-script flow',
        blurb: 'From Guide §3 — what the start scripts load and launch.',
        fieldKeys: ['startLoadsEnv', 'startLaunches'],
      },
    ],
    fields: [
      { section: 'Processes', key: 'masterPidHint', label: 'Master PID', hint: 'PID of the Master process on ds-spark-01 (from ps / jps).' },
      { section: 'Processes', key: 'worker0PidHint', label: 'ds-spark-02 Worker PID', hint: 'PID of the Worker on ds-spark-02.' },
      { section: 'Processes', key: 'worker1PidHint', label: 'ds-spark-03 Worker PID', hint: 'PID of the Worker on ds-spark-03.' },
      { section: 'On disk — master', key: 'masterLogs', label: 'Master log directory' },
      { section: 'On disk — master', key: 'masterWork', label: 'Master work directory' },
      { section: 'On disk — master', key: 'masterConf', label: 'Master conf directory' },
      { section: 'On disk — workers', key: 'workerLogs', label: 'Worker log directory', hint: 'Same layout on both workers is fine.' },
      { section: 'On disk — workers', key: 'workerWork', label: 'Worker work directory' },
      {
        section: 'Config roles',
        key: 'sparkEnvRole',
        label: 'What does spark-env.sh configure?',
        hint: 'Open conf/spark-env.sh on a node, then pick one.',
        options: [
          { id: 'ui-only', label: 'Master UI refresh rate only' },
          { id: 'scheduler', label: 'YARN queue names and fair-scheduler weights' },
          { id: 'daemon', label: 'Daemon / process settings for Master and Worker (env before they start)' },
          { id: 'application', label: 'Application SparkConf defaults for jobs' },
        ],
      },
      {
        section: 'Config roles',
        key: 'sparkDefaultsRole',
        label: 'What does spark-defaults.conf configure?',
        hint: 'Open conf/spark-defaults.conf on a node, then pick one.',
        options: [
          { id: 'daemon', label: 'Daemon / process settings for Master and Worker (env before they start)' },
          { id: 'os-limits', label: 'Linux ulimit and cgroup limits for the host' },
          { id: 'application', label: 'Application SparkConf defaults for jobs' },
          { id: 'keystore', label: 'TLS keystore passwords for the JVM only' },
        ],
      },
      {
        section: 'Start-script flow',
        key: 'startLoadsEnv',
        label: 'Before the JVM starts, which file is sourced for daemon env?',
        options: [
          { id: 'spark-defaults', label: 'conf/spark-defaults.conf' },
          { id: 'neither', label: 'Neither — conf/ is ignored' },
          { id: 'log4j-only', label: 'Only log4j2.properties' },
          { id: 'spark-env', label: 'conf/spark-env.sh' },
        ],
      },
      {
        section: 'Start-script flow',
        key: 'startLaunches',
        label: 'What do start-master.sh / start-worker.sh launch?',
        options: [
          { id: 'docker-compose', label: 'docker compose up' },
          { id: 'spark-submit-job', label: 'A spark-submit job' },
          { id: 'java-daemon', label: 'A Java Master or Worker daemon' },
          { id: 'systemd-unit', label: 'A systemd spark.service unit' },
        ],
      },
    ],
  },
  'spark-02-read-the-master-ui-and-a-worker-ui-as-instruments': {
    intro:
      'Walk the incident in story order. Answers save as you go — Incomplete Investigation still fails on Submit.',
    steps: [
      {
        id: 'symptom',
        title: 'Symptom',
        blurb: 'What the Master UI claimed when you opened the incident.',
        fieldKeys: ['masterSymptom', 'heartbeatMeaning'],
      },
      {
        id: 'prove',
        title: 'Prove on the node',
        blurb: 'Which host, why it flapped again, and the lasting fix.',
        fieldKeys: ['downWorker', 'flapCause', 'lastingFix'],
      },
      {
        id: 'control-plane',
        title: 'Control plane',
        blurb: 'RPC port, who heartbeats, and what the Master does when signals stop.',
        fieldKeys: ['masterRpcPort', 'heartbeatWho', 'missedHeartbeat'],
      },
      {
        id: 'after-fix',
        title: 'After the fix',
        blurb: 'What the UIs are for, then the stable Master / Worker readings.',
        fieldKeys: [
          'instrumentLesson',
          'aliveWorkers',
          'coresTotal',
          'memoryTotal',
          'runningApps',
          'workerExecutors',
        ],
      },
    ],
    fields: [
      {
        section: 'Symptom (Master UI)',
        key: 'masterSymptom',
        label: 'What did the Master UI show when you opened the incident?',
        options: [
          { id: 'no-master', label: 'Master process was down — UI port 8080 refused' },
          { id: 'apps-failing', label: 'Running applications were crashing in a loop' },
          { id: 'not-two-alive', label: 'Fewer than 2 ALIVE workers (one Worker DEAD / missing)' },
          { id: 'all-fine', label: 'Everything looked fine — 2 ALIVE already' },
        ],
      },
      {
        section: 'Symptom (Master UI)',
        key: 'heartbeatMeaning',
        label: 'When the Master UI shows a Worker as DEAD / not ALIVE, what does that mean by itself?',
        options: [
          { id: 'daemon-proven', label: 'Proof the Worker JVM is dead — no need to look at the host' },
          { id: 'http-ui-down', label: 'Proof the Worker HTTP UI on 8081/8082 is down' },
          { id: 'network-only', label: 'Proof the fault is only a network partition, never a stopped daemon' },
          {
            id: 'master-stopped-hearing',
            label: 'The Master stopped receiving Worker heartbeats over RPC — root cause still unknown until you check the node',
          },
        ],
      },
      {
        section: 'Prove on the node',
        key: 'downWorker',
        label: 'Which Worker host was the problem on?',
        options: [
          { id: 'ds-spark-03', label: 'ds-spark-03' },
          { id: 'shell', label: 'shell' },
          { id: 'ds-spark-01', label: 'ds-spark-01' },
          { id: 'ds-spark-02', label: 'ds-spark-02' },
        ],
      },
      {
        section: 'Prove on the node',
        key: 'flapCause',
        label: 'After you brought the Worker back, why did the Master UI show it down again after a short while?',
        options: [
          { id: 'no-flap', label: 'It never went down again — start-worker alone was enough forever' },
          { id: 'wrong-rpc-port', label: 'The Worker was sending heartbeats to port 8080 instead of 7077' },
          {
            id: 'timeout-too-large',
            label: 'That host’s spark.worker.timeout was huge — Worker heartbeats (timeout/4) were rarer than the Master’s 30s budget',
          },
          { id: 'master-timeout-too-small', label: 'The Master’s spark.worker.timeout was deleted entirely' },
        ],
      },
      {
        section: 'Prove on the node',
        key: 'lastingFix',
        label: 'What lasting fix kept the Worker ALIVE on the Master UI?',
        options: [
          { id: 'restart-master', label: 'Restarted the Master on ds-spark-01' },
          { id: 'start-worker-only', label: 'Only ran start-worker.sh and left conf unchanged' },
          { id: 'raise-timeout', label: 'Raised the Master’s spark.worker.timeout so DEAD never happens' },
          {
            id: 'timeout-30-restart',
            label: 'Set spark.worker.timeout back to 30 on that Worker host and restarted the Worker',
          },
        ],
      },
      {
        section: 'Control plane',
        key: 'masterRpcPort',
        label: 'Master Spark RPC listen port (Workers register here)',
        options: [
          { id: '8080', label: '8080' },
          { id: '4040', label: '4040' },
          { id: '7077', label: '7077' },
          { id: '8081', label: '8081' },
        ],
      },
      {
        section: 'Control plane',
        key: 'heartbeatWho',
        label: 'How does a Worker stay listed as ALIVE on the Master?',
        options: [
          { id: 'ui-poll', label: 'The Master UI polls workers on port 8081' },
          { id: 'master-to-worker', label: 'The Master sends heartbeats to each Worker over HTTP' },
          { id: 'driver-only', label: 'Only spark-submit drivers heartbeat; workers never do' },
          { id: 'worker-to-master', label: 'Each Worker sends heartbeats to the Master over RPC' },
        ],
      },
      {
        section: 'Control plane',
        key: 'missedHeartbeat',
        label: 'If those Worker → Master signals stop arriving in time, what does the Master do?',
        options: [
          { id: 'ui-only', label: 'Only refreshes the Worker HTTP UI' },
          { id: 'master-marks-dead', label: 'Marks that Worker DEAD / drops it from ALIVE' },
          { id: 'kills-apps', label: 'Immediately kills every running application' },
          { id: 'restarts-jvm', label: 'SSHs to the host and restarts the Worker JVM' },
        ],
      },
      {
        section: 'Instruments',
        key: 'instrumentLesson',
        label: 'What are the Master / Worker UIs in this lab?',
        options: [
          { id: 'optional', label: 'Optional decoration — ignore them for restore work' },
          { id: 'source-of-truth', label: 'Source of truth — the node can never disagree with the UI' },
          { id: 'yarn-rm', label: 'A ResourceManager replacement on standalone Spark' },
          {
            id: 'claim-then-verify',
            label: 'Instruments — claims to read, then verify on the node before you trust them',
          },
        ],
      },
      { section: 'Master UI (after fix)', key: 'aliveWorkers', label: 'Workers ALIVE' },
      { section: 'Master UI (after fix)', key: 'coresTotal', label: 'Total cores the master shows' },
      {
        section: 'Master UI (after fix)',
        key: 'memoryTotal',
        label: 'Total memory the master shows (MB)',
      },
      { section: 'Master UI (after fix)', key: 'runningApps', label: 'Running applications' },
      {
        section: 'Worker UI (after fix)',
        key: 'workerExecutors',
        label: 'Running executors on a Worker UI',
      },
    ],
  },
  'spark-03-trace-a-job-from-submission-to-last-task': {
    intro:
      'Walk three DAG shapes. Answers save as you go — Incomplete Investigation still fails on Submit.',
    steps: [
      {
        id: 'submit',
        title: 'Submit shape',
        blurb: 'How you launched all three jobs, and which screens showed them.',
        fieldKeys: ['deployMode', 'driverWhere', 'whereRegistered', 'whereStages'],
      },
      {
        id: 'part-1',
        title: 'Part 1 — narrow',
        blurb: 'orders-narrow: transforms + write, no shuffle.',
        fieldKeys: ['narrowAppId', 'narrowStageCount', 'narrowShuffles'],
      },
      {
        id: 'part-2',
        title: 'Part 2 — one shuffle',
        blurb: 'orders-by-store: groupBy sum — one shuffle boundary.',
        fieldKeys: ['oneShuffleAppId', 'oneShuffleStageCount', 'oneShuffleCount'],
      },
      {
        id: 'part-3',
        title: 'Part 3 — multi-shuffle',
        blurb: 'store-rollup-join: stages, then one task down to a Worker host.',
        fieldKeys: ['multiAppId', 'multiStageCount', 'taskId', 'executorId', 'workerHost'],
      },
      {
        id: 'lesson',
        title: 'Lesson',
        blurb: 'What the three DAGs were meant to teach.',
        fieldKeys: ['dagLesson', 'chainLesson', 'instrumentLesson'],
      },
    ],
    fields: [
      {
        section: 'Shared submit',
        key: 'deployMode',
        label: 'Deploy mode you used for all three parts',
        options: [
          { id: 'cluster', label: 'cluster' },
          { id: 'yarn', label: 'yarn (ResourceManager)' },
          { id: 'client', label: 'client' },
          { id: 'local', label: 'local[*]' },
        ],
      },
      {
        section: 'Shared submit',
        key: 'driverWhere',
        label: 'Where did the driver run (client mode)?',
        options: [
          { id: 'ds-spark-01', label: 'ds-spark-01 (Master host)' },
          { id: 'ds-spark-02', label: 'ds-spark-02' },
          { id: 'shell', label: 'shell (the submit client)' },
          { id: 'ds-spark-03', label: 'ds-spark-03' },
        ],
      },
      {
        section: 'Shared submit',
        key: 'whereRegistered',
        label: 'Where did each application register with the cluster?',
        options: [
          { id: 'worker-ui', label: 'Only on a Worker HTTP UI' },
          { id: 'master-ui', label: 'On the Master UI (Running / Completed Applications)' },
          { id: 'spark-defaults', label: 'In spark-defaults.conf' },
          { id: 'nowhere', label: 'Nowhere — standalone Spark never lists applications' },
        ],
      },
      {
        section: 'Shared submit',
        key: 'whereStages',
        label: 'Where did you read Jobs → Stages → Tasks?',
        options: [
          { id: 'master-only', label: 'Only the Master Workers panel' },
          { id: 'worker-log', label: 'Only a Worker log file' },
          { id: 'app-ui', label: 'The Application UI (driver)' },
          { id: 'spark-env', label: 'conf/spark-env.sh' },
        ],
      },
      {
        section: 'Part 1 — narrow',
        key: 'narrowAppId',
        label: 'Part 1 application id',
        hint: 'orders-narrow — looks like app-…',
      },
      {
        section: 'Part 1 — narrow',
        key: 'narrowStageCount',
        label: 'How many stages in Part 1?',
        hint: 'Expect 1.',
      },
      {
        section: 'Part 1 — narrow',
        key: 'narrowShuffles',
        label: 'How many shuffle boundaries in Part 1?',
        options: [
          { id: '0', label: '0 — no Shuffle Read/Write' },
          { id: '1', label: '1' },
          { id: '2', label: '2 or more' },
        ],
      },
      {
        section: 'Part 2 — one shuffle',
        key: 'oneShuffleAppId',
        label: 'Part 2 application id',
        hint: 'orders-by-store — different from Part 1.',
      },
      {
        section: 'Part 2 — one shuffle',
        key: 'oneShuffleStageCount',
        label: 'How many stages in Part 2?',
        hint: 'Expect 2.',
      },
      {
        section: 'Part 2 — one shuffle',
        key: 'oneShuffleCount',
        label: 'How many shuffle boundaries in Part 2?',
        options: [
          { id: '0', label: '0' },
          { id: '1', label: '1 — one Shuffle Write then one Shuffle Read' },
          { id: '2', label: '2 or more' },
        ],
      },
      {
        section: 'Part 3 — multi-shuffle',
        key: 'multiAppId',
        label: 'Part 3 application id',
        hint: 'store-rollup-join — different from Parts 1 and 2.',
      },
      {
        section: 'Part 3 — multi-shuffle',
        key: 'multiStageCount',
        label: 'How many stages in Part 3?',
        hint: 'At least 3.',
      },
      { section: 'Part 3 — one task', key: 'taskId', label: 'Task id you followed' },
      { section: 'Part 3 — one task', key: 'executorId', label: 'Executor id that ran it' },
      {
        section: 'Part 3 — one task',
        key: 'workerHost',
        label: 'Worker host for that executor',
        options: [
          { id: 'shell', label: 'shell' },
          { id: 'ds-spark-01', label: 'ds-spark-01' },
          { id: 'ds-spark-02', label: 'ds-spark-02' },
          { id: 'ds-spark-03', label: 'ds-spark-03' },
        ],
      },
      {
        section: 'Lesson',
        key: 'dagLesson',
        label: 'What did the three jobs show about stages?',
        options: [
          { id: 'always-one', label: 'Every Spark job is exactly one stage' },
          {
            id: 'shuffle-boundaries',
            label: 'Narrow work stays one stage; each shuffle boundary adds stages',
          },
          { id: 'master-decides', label: 'The Master UI picks the stage count, not the DAG' },
          { id: 'show-causes-shuffle', label: 'Only show() creates shuffles; groupBy never does' },
        ],
      },
      {
        section: 'Lesson',
        key: 'chainLesson',
        label: 'Which chain matches what you traced?',
        options: [
          {
            id: 'submit-to-task',
            label: 'spark-submit → driver → application → stage → task → executor / Worker host',
          },
          { id: 'ui-only', label: 'Master UI alone is enough — stages never need the Application UI' },
          { id: 'worker-first', label: 'Worker UI creates the application, then the Master notices' },
          { id: 'map-enough', label: 'Part 1 alone covers everything this lab asks for' },
        ],
      },
      {
        section: 'Lesson',
        key: 'instrumentLesson',
        label: 'What are the Master / Application / Worker UIs in this lab?',
        options: [
          { id: 'optional', label: 'Optional decoration — ignore them for the trace' },
          { id: 'source-of-truth', label: 'Source of truth — the node can never disagree with the UI' },
          { id: 'yarn-rm', label: 'A ResourceManager replacement on standalone Spark' },
          {
            id: 'claim-then-verify',
            label: 'Instruments — claims to read, then verify on the node before you trust them',
          },
        ],
      },
    ],
  },
  'spark-04-find-where-the-data-actually-lives': {
    intro:
      'Name why caching did not help before changing any config. Incomplete Investigation fails on Submit.',
    fields: [
      { section: 'Storage tab', key: 'storageClaim', label: 'What Storage shows for the cached RDD', hint: 'Empty, size, or fraction cached.' },
      { section: 'Executors tab', key: 'executorMemoryNote', label: 'What the per-executor memory breakdown shows' },
      { section: 'Worker log', key: 'workerLogSignal', label: 'Relevant line or signal from a worker log' },
      {
        section: 'Cause',
        key: 'rootCause',
        label: 'Why the second action was not faster',
        hint: 'Plain language: never cached, evicted, wrong persistence level, etc.',
      },
      {
        section: 'Cause',
        key: 'configUntouched',
        label: 'Confirm you did not raise executor memory to hide it',
        hint: 'yes / still at original sizing.',
      },
    ],
  },
  'spark-05-the-executor-memory-map': {
    intro:
      'Record the map and your three predictions. Incomplete Investigation fails on Submit.',
    fields: [
      {
        section: 'Diagram',
        key: 'heapRegions',
        label: 'On-heap regions (ordered)',
        hint: 'e.g. reserved / user / unified.',
      },
      {
        section: 'Diagram',
        key: 'outsideHeap',
        label: 'Outside the heap',
        hint: 'overhead and off-heap — keep them separate.',
      },
      {
        section: 'Knobs',
        key: 'fractionVsStorage',
        label: 'memory.fraction vs storageFraction',
        hint: 'Which split happens first, and what each splits.',
      },
      { section: 'Predictions', key: 'prediction1', label: 'Prediction 1 — room for task execution' },
      { section: 'Predictions', key: 'prediction2', label: 'Prediction 2 — room for task execution' },
      { section: 'Predictions', key: 'prediction3', label: 'Prediction 3 — room for task execution' },
    ],
  },
  'spark-06-diagnose-an-executor-lost-to-memory-pressure': {
    intro:
      'Misplaced oversized hold on the big Worker; victim needs that host alone. Keep the hold running. Incomplete Investigation fails on Submit.',
    steps: [
      {
        id: 'symptom',
        title: 'Symptom',
        blurb: 'What store-rollup-mem showed when it failed beside the hold.',
        fieldKeys: ['lossPattern'],
      },
      {
        id: 'placement',
        title: 'Why the hold is on B',
        blurb: 'Request vs Worker offers, and whether usage justifies the ask.',
        fieldKeys: ['holdWhyOnBig', 'holdUsageClue'],
      },
      {
        id: 'victim',
        title: 'Why the victim needs B',
        blurb: 'Why the small Worker cannot run store-rollup-mem.',
        fieldKeys: ['victimNeedsBig'],
      },
      {
        id: 'fix',
        title: 'Fix',
        blurb: 'Right-size + relocate the hold; do not only raise victim memory.',
        fieldKeys: ['fixApplied', 'raiseOnlyLesson'],
      },
    ],
    fields: [
      {
        section: 'Symptom',
        key: 'lossPattern',
        label: 'What did you see when store-rollup-mem failed?',
        options: [
          { id: 'driver-oom', label: 'Clean OutOfMemoryError on the driver with a full stack' },
          {
            id: 'executor-lost-task',
            label: 'Lost task / Python worker crashed — driver stayed up',
          },
          { id: 'accepted-forever', label: 'Application stayed Accepted forever with zero executors' },
          { id: 'master-down', label: 'Master process exited' },
        ],
      },
      {
        section: 'Hold on B',
        key: 'holdWhyOnBig',
        label: 'Why was team-b-debug-hold on the big Worker?',
        options: [
          { id: 'random', label: 'Master always prefers ds-spark-03 for every app' },
          {
            id: 'request-exceeds-small',
            label: 'Its 1024m request exceeds ds-spark-02’s 768m offer — only B can take it',
          },
          { id: 'needs-2-cores', label: 'The hold requires 2 cores and A only has 1' },
          { id: 'disk', label: 'A’s disk was full so Master skipped it' },
        ],
      },
      {
        section: 'Hold on B',
        key: 'holdUsageClue',
        label: 'What did Storage / Executors show for the hold’s real footprint?',
        options: [
          { id: 'fully-used', label: 'Storage near 1024m — the ask was fully justified' },
          {
            id: 'used-much-less',
            label: 'Cached/used size much smaller than 1024m — safe to right-size',
          },
          { id: 'empty-never', label: 'Storage empty because cache() was never reached' },
          { id: 'disk-only', label: 'Everything was on disk only from the start' },
        ],
      },
      {
        section: 'Victim',
        key: 'victimNeedsBig',
        label: 'Why can store-rollup-mem not simply run on the small Worker?',
        options: [
          { id: 'victim-request-gt-small', label: 'Its 1024m ask is larger than ds-spark-02’s 768m offer' },
          { id: 'name-blacklist', label: 'Master blacklists store-rollup-mem on ds-spark-02' },
          { id: 'needs-python3', label: 'A does not have Python installed' },
          { id: 'can-run-a', label: 'It can — A is large enough for 1024m' },
        ],
      },
      {
        section: 'Fix',
        key: 'fixApplied',
        label: 'What fix made both workloads healthy?',
        options: [
          { id: 'raise-only', label: 'Only raised store-rollup-mem memory and left the hold on B' },
          {
            id: 'rightsize-hold-to-small',
            label: 'Right-sized the hold so it sits on ds-spark-02, then ran the victim on B',
          },
          { id: 'kill-hold-forever', label: 'Deleted team-b-debug-hold permanently and only ran the victim' },
          { id: 'local-mode', label: 'Switched both jobs to local[*]' },
        ],
      },
      {
        section: 'Fix',
        key: 'raiseOnlyLesson',
        label: 'Why is raising victim memory alone the wrong fix?',
        options: [
          {
            id: 'raise-alone-fails',
            label: 'The hold still occupies the big Worker — victim still shares that host',
          },
          { id: 'memory-never', label: 'Executor memory never matters on standalone' },
          { id: 'must-raise', label: 'You must always raise memory first' },
          { id: 'ui-blocks', label: 'The Master UI forbids memory changes' },
        ],
      },
    ],
  },
  'spark-07-the-capstone-bug-slow-then-dead': {
    intro:
      'Healthy → shuffle trouble → FetchFailed. Local shuffle dirs / disk pressure — platform fix. Incomplete Investigation fails on Submit.',
    steps: [
      {
        id: 'timeline',
        title: 'Timeline',
        blurb: 'When it was healthy, when shuffle hurt, when it died.',
        fieldKeys: ['whenHealthy', 'whenSlow', 'whenDead'],
      },
      {
        id: 'signals',
        title: 'Signals',
        blurb: 'Driver/UI, worker local disk or work path, executor/worker log.',
        fieldKeys: ['signalDriverUi', 'signalLocalDisk', 'signalWorkerLog'],
      },
      {
        id: 'cause',
        title: 'Cause',
        blurb: 'Lost shuffle locals under disk pressure — not an app cache() edit.',
        fieldKeys: ['rootCause'],
      },
      {
        id: 'fix',
        title: 'Fix',
        blurb: 'Protect local shuffle dirs / free space; re-run green.',
        fieldKeys: ['fixApplied', 'wrongFixLesson'],
      },
    ],
    fields: [
      {
        section: 'Timeline',
        key: 'whenHealthy',
        label: 'What still looked healthy early?',
        options: [
          { id: 'never', label: 'Nothing — the job failed before any stage ran' },
          {
            id: 'pre-shuffle',
            label: 'Early / pre-shuffle work — then the shuffle boundary hurt',
          },
          { id: 'always-slow', label: 'It was slow from the first task with no clear boundary' },
          { id: 'master-only', label: 'Only the Master UI was healthy; no job ran' },
        ],
      },
      {
        section: 'Timeline',
        key: 'whenSlow',
        label: 'What marked the slow phase?',
        options: [
          { id: 'ui-refresh', label: 'The Master UI refresh rate changed' },
          {
            id: 'shuffle-retries',
            label: 'Shuffle stage retries / stragglers / fetch trouble',
          },
          { id: 'dns', label: 'DNS lookups for ds-spark-01 started failing' },
          { id: 'idle', label: 'All executors sat idle with no tasks' },
        ],
      },
      {
        section: 'Timeline',
        key: 'whenDead',
        label: 'How did the job die?',
        options: [
          { id: 'fetch-failed', label: 'FetchFailed / stage failure reading shuffle output' },
          { id: 'driver-oom', label: 'Driver OutOfMemoryError only' },
          { id: 'accepted', label: 'Stayed Accepted with no executors forever' },
          { id: 'kill-shell', label: 'Someone killed the shell pod' },
        ],
      },
      {
        section: 'Signals',
        key: 'signalDriverUi',
        label: 'Driver / Application UI signal',
        options: [
          { id: 'fetch-or-stage', label: 'FetchFailed or failed shuffle stage / task errors' },
          { id: 'green-storage', label: 'Storage tab 100% cached and idle' },
          { id: 'no-jobs', label: 'Jobs tab empty the whole time' },
          { id: 'yarn-rm', label: 'ResourceManager queue Accepted' },
        ],
      },
      {
        section: 'Signals',
        key: 'signalLocalDisk',
        label: 'Local disk / work path signal',
        options: [
          {
            id: 'local-full-or-missing',
            label: 'Worker spark-local / work path full, tiny, or shuffle blocks missing',
          },
          { id: 'root-empty', label: 'Root filesystem completely empty' },
          { id: 'nfs-fast', label: 'Local dirs on a fast empty SSD with no pressure' },
          { id: 'no-work', label: 'No SPARK_HOME/work directory exists on any Worker' },
        ],
      },
      {
        section: 'Signals',
        key: 'signalWorkerLog',
        label: 'Worker / executor log signal',
        options: [
          {
            id: 'disk-or-io',
            label: 'Disk / IO / block manager errors around shuffle locals',
          },
          { id: 'timeout-only', label: 'Only spark.worker.timeout heartbeat messages' },
          { id: 'silent', label: 'Logs completely empty' },
          { id: 'auth', label: 'Kerberos ticket expired' },
        ],
      },
      {
        section: 'Cause',
        key: 'rootCause',
        label: 'Root cause',
        options: [
          {
            id: 'shuffle-local-disk',
            label: 'Shuffle locals under Worker local/work dirs hit disk pressure / were wiped',
          },
          { id: 'app-cache-leak', label: 'Unbounded cache() in the job code — fix by editing persist' },
          { id: 'cotenant-pack', label: 'A second app packed onto the same Worker (Lab 6 style)' },
          { id: 'wrong-master', label: 'Jobs pointed at the wrong Master URL' },
        ],
      },
      {
        section: 'Fix',
        key: 'fixApplied',
        label: 'What platform fix made the shuffle survive?',
        options: [
          {
            id: 'protect-local-rerun',
            label: 'Stopped the wipe/filler, freed local shuffle space, re-ran the job',
          },
          { id: 'edit-cache', label: 'Removed cache() from the application and left disk full' },
          { id: 'raise-executors', label: 'Only raised executor count with no disk change' },
          { id: 'kill-master', label: 'Restarted only the Master' },
        ],
      },
      {
        section: 'Fix',
        key: 'wrongFixLesson',
        label: 'What is the wrong “fix” here?',
        options: [
          {
            id: 'ignore-disk',
            label: 'Ignore Worker local disk and only bump executor memory/count',
          },
          { id: 'always-disk-first', label: 'Always reformat every Worker disk before any submit' },
          { id: 'no-shuffle', label: 'Disable all shuffles in spark-defaults forever' },
          { id: 'yarn-only', label: 'Move every job to YARN without checking local dirs' },
        ],
      },
    ],
  },
  'spark-08-post-maintenance-mess': {
    intro:
      'Three maintenance faults stacked: stale Master URL, locked work dirs, broken eventlogs path. Incomplete Investigation fails on Submit.',
    steps: [
      {
        id: 'faults',
        title: 'Faults',
        blurb: 'What maintenance broke — URL, work dir, event logs.',
        fieldKeys: ['staleMasterClue', 'workDirFault', 'eventLogFault'],
      },
      {
        id: 'fix',
        title: 'Fix',
        blurb: 'Order of repair and what not to do.',
        fieldKeys: ['fixOrderLesson', 'wrongFixLesson'],
      },
    ],
    fields: [
      {
        section: 'Faults',
        key: 'staleMasterClue',
        label: 'Where did you find the wrong Master URL?',
        options: [
          {
            id: 'maintenance-url-file',
            label: '~/lab/MAINTENANCE_MASTER (and notes) — not $SPARK_MASTER_URL',
          },
          { id: 'yarn-rm', label: 'YARN ResourceManager UI on :8088' },
          { id: 'history', label: 'History Server only' },
          { id: 'no-url', label: 'There was no Master URL problem' },
        ],
      },
      {
        section: 'Faults',
        key: 'workDirFault',
        label: 'What was wrong with $SPARK_HOME/work on the Workers?',
        options: [
          { id: 'chmod-locked', label: 'Permissions locked (chmod 000) — executors could not write' },
          { id: 'nfs-only', label: 'It was an NFS mount that was fine' },
          { id: 'missing-spark', label: 'SPARK_HOME itself was deleted' },
          { id: 'full-root', label: 'Root filesystem was 100% full with no other clue' },
        ],
      },
      {
        section: 'Faults',
        key: 'eventLogFault',
        label: 'What was wrong with the event log path?',
        options: [
          {
            id: 'file-not-dir',
            label: 'eventlogs was a file where a directory should be',
          },
          { id: 'disabled-ok', label: 'Event logging was correctly disabled forever' },
          { id: 's3-only', label: 'It only worked on S3' },
          { id: 'no-event', label: 'Nothing was wrong with event logs' },
        ],
      },
      {
        section: 'Fix',
        key: 'fixOrderLesson',
        label: 'Sensible repair order?',
        options: [
          {
            id: 'url-then-perms-then-eventlogs',
            label: 'Real Master URL + Workers up → unlock work → restore eventlogs dir → re-run',
          },
          { id: 'eventlogs-only', label: 'Only fix eventlogs and ignore Workers' },
          { id: 'kill-master-first', label: 'Kill the Master first every time' },
          { id: 'raise-memory', label: 'Only raise executor memory' },
        ],
      },
      {
        section: 'Fix',
        key: 'wrongFixLesson',
        label: 'What is the wrong approach?',
        options: [
          {
            id: 'ignore-maintenance-notes',
            label: 'Ignore maintenance notes and keep using the stale Master URL',
          },
          { id: 'must-read-notes', label: 'You must always read maintenance notes first' },
          { id: 'chmod-forever', label: 'Leave work at chmod 000 for security' },
          { id: 'file-eventlogs', label: 'Keep eventlogs as a file so nothing is logged' },
        ],
      },
    ],
  },
  'spark-14-dns-memory-and-disk-triple': {
    intro:
      'Three layers: bad driver host → tiny memoryOverhead → DISK_FILLER. Peel in order. Incomplete Investigation fails on Submit.',
    steps: [
      {
        id: 'layers',
        title: 'Layers',
        blurb: 'Which fault is first, second, third.',
        fieldKeys: ['firstLayer', 'secondLayer', 'thirdLayer'],
      },
      {
        id: 'fix',
        title: 'Fix',
        blurb: 'Peel order and the wrong shortcut.',
        fieldKeys: ['peelOrder', 'wrongFixLesson'],
      },
    ],
    fields: [
      {
        section: 'Layers',
        key: 'firstLayer',
        label: 'What blocks the job first?',
        options: [
          {
            id: 'driver-host',
            label: 'Bad spark.driver.host — executors cannot reach the client driver',
          },
          { id: 'local-disk-filler', label: 'DISK_FILLER only — nothing else wrong' },
          { id: 'memory-overhead', label: 'Tiny memoryOverhead only — host is fine' },
          { id: 'yarn-queue', label: 'Wrong YARN queue' },
        ],
      },
      {
        section: 'Layers',
        key: 'secondLayer',
        label: 'What shows up after the host is fixed?',
        options: [
          {
            id: 'memory-overhead',
            label: 'Tiny spark.executor.memoryOverhead — lost task / Python worker pressure',
          },
          { id: 'driver-host', label: 'Driver host is still the only problem' },
          { id: 'master-down', label: 'Master process exits' },
          { id: 'dns-ok', label: 'Nothing — the job is green after host only' },
        ],
      },
      {
        section: 'Layers',
        key: 'thirdLayer',
        label: 'What remains after host + overhead are fixed?',
        options: [
          {
            id: 'local-disk-filler',
            label: 'DISK_FILLER / pressure under Worker spark-local',
          },
          { id: 'driver-host', label: 'Driver host again' },
          { id: 'no-third', label: 'There is no third fault' },
          { id: 'kerberos', label: 'Kerberos ticket expired' },
        ],
      },
      {
        section: 'Fix',
        key: 'peelOrder',
        label: 'Correct peel order?',
        options: [
          {
            id: 'host-then-overhead-then-disk',
            label: 'Driver host → memoryOverhead → remove DISK_FILLER → re-run',
          },
          { id: 'disk-first', label: 'Always delete DISK_FILLER first and ignore host' },
          { id: 'overhead-only', label: 'Only raise overhead forever' },
          { id: 'random', label: 'Order does not matter' },
        ],
      },
      {
        section: 'Fix',
        key: 'wrongFixLesson',
        label: 'What is the wrong shortcut?',
        options: [
          {
            id: 'bump-cores-only',
            label: 'Only bump executor cores/count and leave host, overhead, and disk alone',
          },
          { id: 'must-peel', label: 'You must peel every layer' },
          { id: 'host-required', label: 'Fixing the driver host is required' },
          { id: 'disk-required', label: 'Removing DISK_FILLER is required' },
        ],
      },
    ],
  },
  'spark-09-submit-the-same-workload-on-yarn': {
    intro:
      'Start with YARN forensics on this migrated cluster, then fix ~/lab/submit-store-rollup.sh and prove client + cluster. Submit checks forensics, the wrapper, and both apps.',
    steps: [
      {
        id: 'forensics',
        title: 'Forensics',
        blurb: 'Same hosts as Chapter 1 — roles changed. Map RM / NM before you touch the wrapper.',
        fieldKeys: ['rmHostRole', 'noMaster', 'activeNodesExpect'],
      },
      {
        id: 'fix',
        title: 'Fix',
        blurb: 'The planted submit-store-rollup.sh still speaks standalone. Translate it to YARN.',
        fieldKeys: ['oldSubmitContract', 'yarnResourceContract'],
      },
      {
        id: 'client',
        title: 'Client mode',
        blurb: 'store-rollup-client — driver stays on the shell.',
        fieldKeys: ['clientAppId', 'clientDriverHost', 'clientRmPanel', 'clientNmPanel'],
      },
      {
        id: 'cluster',
        title: 'Cluster mode',
        blurb: 'store-rollup-cluster — driver is the ApplicationMaster container.',
        fieldKeys: ['clusterAppId', 'clusterDriverHost', 'clusterAmIsContainer'],
      },
      {
        id: 'lesson',
        title: 'Lesson',
        blurb: 'What the forensics and the two submits were meant to teach.',
        fieldKeys: ['deployModeDelta', 'whyBothModes'],
      },
    ],
    fields: [
      {
        section: 'Topology',
        key: 'rmHostRole',
        label: 'What process owns ds-spark-01 in this lab?',
        options: [
          { id: 'spark-master', label: 'Spark Master (standalone)' },
          { id: 'resourcemanager', label: 'YARN ResourceManager' },
          { id: 'nodemanager', label: 'YARN NodeManager only' },
          { id: 'history', label: 'Spark History Server only' },
        ],
      },
      {
        section: 'Topology',
        key: 'noMaster',
        label: 'Is there a Spark Master / Worker on this cluster?',
        options: [
          { id: 'yarn-only', label: 'No — YARN owns the hosts; Spark asks for containers' },
          { id: 'master-too', label: 'Yes — Master on 01, Workers on 02/03, plus YARN' },
          { id: 'workers-only', label: 'Workers only — Master is optional on YARN' },
          { id: 'k8s', label: 'No — this lab is Spark on Kubernetes' },
        ],
      },
      {
        section: 'Topology',
        key: 'activeNodesExpect',
        label: 'How many active NodeManagers should the RM list before you submit?',
        options: [
          { id: '0', label: '0' },
          { id: '1', label: '1' },
          { id: '2', label: '2' },
          { id: '3', label: '3' },
        ],
      },
      {
        section: 'Fix',
        key: 'oldSubmitContract',
        label: 'Why does submit-store-rollup.sh fail on this YARN cluster?',
        options: [
          {
            id: 'standalone-contract',
            label: 'It targeted a standalone Master and used a standalone total-core request',
          },
          { id: 'missing-queue', label: 'Every YARN submit must name a non-default queue' },
          { id: 'python', label: 'YARN cannot run Python applications' },
          { id: 'too-small', label: '512m executors are always invalid on YARN' },
        ],
      },
      {
        section: 'Fix',
        key: 'yarnResourceContract',
        label: 'How should the standalone total-core request translate on YARN?',
        options: [
          {
            id: 'instances-and-cores',
            label: '2 executor instances × 1 core each',
          },
          { id: 'one-am', label: '1 ApplicationMaster × 2 cores; no executors' },
          { id: 'worker-cores', label: 'Set SPARK_WORKER_CORES=2 on the NodeManagers' },
          { id: 'rm-cores', label: 'Give 2 cores directly to the ResourceManager JVM' },
        ],
      },
      {
        section: 'Client mode',
        key: 'clientAppId',
        label: 'Client-mode application id',
        hint: 'application_… for store-rollup-client — from yarn application -list or the RM UI.',
      },
      {
        section: 'Client mode',
        key: 'clientDriverHost',
        label: 'Where the client-mode driver ran',
        options: [
          { id: 'shell', label: 'shell (the spark-submit process)' },
          { id: 'ds-spark-01', label: 'ds-spark-01 (ResourceManager host)' },
          { id: 'ds-spark-02', label: 'ds-spark-02 (a NodeManager)' },
          { id: 'ds-spark-03', label: 'ds-spark-03 (a NodeManager)' },
        ],
      },
      {
        section: 'Client mode',
        key: 'clientRmPanel',
        label: 'Which RM panel showed the application?',
        options: [
          { id: 'applications', label: 'Applications (app id / state / allocated resources)' },
          { id: 'scheduler-only', label: 'Scheduler queues only — no application row' },
          { id: 'master-workers', label: 'Master Workers panel (standalone)' },
          { id: 'history-18080', label: 'History server on port 18080' },
        ],
      },
      {
        section: 'Client mode',
        key: 'clientNmPanel',
        label: 'Which NM view showed the containers?',
        options: [
          { id: 'containers', label: 'NodeManager containers / node page for that app' },
          { id: 'worker-ui-8081', label: 'Standalone Worker UI on 8081' },
          { id: 'spark-env', label: 'conf/spark-env.sh' },
          { id: 'none', label: 'Nowhere — containers are invisible on YARN' },
        ],
      },
      {
        section: 'Cluster mode',
        key: 'clusterAppId',
        label: 'Cluster-mode application id',
        hint: 'A second application_… for store-rollup-cluster — not the client-mode id.',
      },
      {
        section: 'Cluster mode',
        key: 'clusterDriverHost',
        label: 'Where the cluster-mode driver (AM) ran',
        options: [
          { id: 'ds-spark-02', label: 'ds-spark-02' },
          { id: 'ds-spark-03', label: 'ds-spark-03' },
          { id: 'shell', label: 'shell' },
          { id: 'ds-spark-01', label: 'ds-spark-01' },
        ],
      },
      {
        section: 'Cluster mode',
        key: 'clusterAmIsContainer',
        label: 'In cluster mode, what is the driver?',
        options: [
          { id: 'am-container', label: 'A YARN ApplicationMaster container on a NodeManager' },
          { id: 'shell-process', label: 'Still the spark-submit JVM on the shell' },
          { id: 'rm-jvm', label: 'Inside the ResourceManager JVM' },
          { id: 'history', label: 'Only the History Server process' },
        ],
      },
      {
        section: 'Lesson',
        key: 'deployModeDelta',
        label: 'What changed between client and cluster mode?',
        options: [
          { id: 'driver-host', label: 'The driver moved from the shell into a YARN container (AM)' },
          { id: 'executor-count', label: 'Cluster mode always gets twice as many executors' },
          { id: 'no-rm', label: 'Cluster mode bypasses the ResourceManager' },
          { id: 'master-back', label: 'Cluster mode starts a Spark Master again' },
        ],
      },
      {
        section: 'Lesson',
        key: 'whyBothModes',
        label: 'Why submit the same join twice in this lab?',
        options: [
          {
            id: 'driver-placement',
            label: 'To see that deploy mode changes where the driver lives — not the join itself',
          },
          { id: 'faster-cluster', label: 'Cluster mode always finishes faster' },
          { id: 'need-hdfs', label: 'Client mode requires HDFS; cluster mode does not' },
          { id: 'queue-only', label: 'Only to pick a different YARN queue' },
        ],
      },
    ],
  },
  'spark-10-read-the-rm-and-nm-as-instruments': {
    intro:
      'Walk the incident in story order. Answers save as you go — Incomplete Investigation still fails on Submit.',
    steps: [
      {
        id: 'symptom',
        title: 'Symptom on the RM',
        blurb: 'What the ResourceManager claimed when you opened the incident.',
        fieldKeys: ['incidentActiveNodes', 'unhealthyHost', 'nodeState'],
      },
      {
        id: 'probe',
        title: 'Stuck probe',
        blurb: 'The morning store-rollup-probe that is RUNNING but produces nothing.',
        fieldKeys: ['probeAppId', 'probeAppState', 'probeSymptom', 'whyNoExecutor'],
      },
      {
        id: 'on-node',
        title: 'On the flagged host',
        blurb: 'Verify the health report on the node before you trust it.',
        fieldKeys: ['nmJvm', 'diskTruth', 'rootCause'],
      },
      {
        id: 'fix',
        title: 'Fix and lesson',
        blurb: 'The lasting fix, and what the RM / NM UI is until you check the node.',
        fieldKeys: ['lastingFix', 'uiIsClaim'],
      },
    ],
    fields: [
      {
        section: 'Symptom on the RM',
        key: 'incidentActiveNodes',
        label: 'How many active NodeManagers did the RM list at the start of the incident?',
        options: [
          { id: '0', label: '0' },
          { id: '1', label: '1' },
          { id: '2', label: '2' },
          { id: '3', label: '3' },
        ],
      },
      {
        section: 'Symptom on the RM',
        key: 'unhealthyHost',
        label: 'Which host did the RM not list as active?',
        options: [
          { id: 'ds-spark-02', label: 'ds-spark-02' },
          { id: 'ds-spark-03', label: 'ds-spark-03' },
          { id: 'ds-spark-01', label: 'ds-spark-01' },
          { id: 'shell', label: 'shell' },
        ],
      },
      {
        section: 'Symptom on the RM',
        key: 'nodeState',
        label: 'What state did the RM give that node?',
        options: [
          { id: 'RUNNING', label: 'RUNNING' },
          { id: 'UNHEALTHY', label: 'UNHEALTHY' },
          { id: 'LOST', label: 'LOST' },
          { id: 'SHUTDOWN', label: 'SHUTDOWN' },
        ],
      },
      {
        section: 'Stuck probe',
        key: 'probeAppId',
        label: 'Stuck probe application id',
        hint: 'application_… for the store-rollup-probe that was RUNNING when you arrived.',
      },
      {
        section: 'Stuck probe',
        key: 'probeAppState',
        label: 'State of that stuck probe on the RM when you arrived',
        options: [
          { id: 'FINISHED', label: 'FINISHED' },
          { id: 'RUNNING', label: 'RUNNING' },
          { id: 'ACCEPTED', label: 'ACCEPTED' },
          { id: 'FAILED', label: 'FAILED' },
        ],
      },
      {
        section: 'Stuck probe',
        key: 'probeSymptom',
        label: 'What did the stuck probe actually hold?',
        options: [
          { id: 'am-only', label: 'An ApplicationMaster container, and no executors' },
          { id: 'am-and-executors', label: 'An AM and both executors already allocated' },
          { id: 'no-containers', label: 'No containers at all — still waiting for an AM' },
          { id: 'finished-quietly', label: 'It had already finished — nothing was stuck' },
        ],
      },
      {
        section: 'Stuck probe',
        key: 'whyNoExecutor',
        label: 'Why could that single healthy NodeManager not place an executor?',
        options: [
          {
            id: 'no-room-after-am',
            label: 'The AM already used most of its 1536 MB — no room left for another 1024 MB container',
          },
          { id: 'queue-full', label: 'The default queue capacity was exhausted' },
          { id: 'wrong-deploy-mode', label: 'Client mode cannot place executors on YARN' },
          { id: 'hdfs-down', label: 'HDFS was down, so Spark could not stage jars' },
        ],
      },
      {
        section: 'On the flagged host',
        key: 'nmJvm',
        label: 'What was true of the NodeManager process on the flagged host?',
        options: [
          { id: 'alive-but-unhealthy', label: 'JVM was still up — RM just marked the node UNHEALTHY' },
          { id: 'jvm-dead', label: 'NodeManager JVM was gone — jps showed nothing' },
          { id: 'rm-down', label: 'ResourceManager was down — NM could not heart beat' },
          { id: 'ui-only-down', label: 'Only the NM HTTP UI on 8042 was down' },
        ],
      },
      {
        section: 'On the flagged host',
        key: 'diskTruth',
        label: 'What did the disk look like on that host (df on the yarn local/log dirs)?',
        options: [
          { id: 'not-full', label: 'Not full — plenty of free space' },
          { id: 'really-full', label: 'Actually full — df matched the health report' },
          { id: 'no-dirs', label: 'The yarn local/log dirs did not exist' },
          { id: 'read-only', label: 'The filesystem was mounted read-only' },
        ],
      },
      {
        section: 'On the flagged host',
        key: 'rootCause',
        label: 'What was the root cause on that host?',
        options: [
          {
            id: 'threshold-too-low',
            label: 'yarn.nodemanager.disk-health-checker.max-disk-utilization-per-disk-percentage was set far too low',
          },
          { id: 'disk-full', label: 'The disk was genuinely full' },
          { id: 'nm-memory', label: 'NM_MEMORY_MB was set to zero' },
          { id: 'wrong-rm-host', label: 'The NodeManager pointed at the wrong ResourceManager' },
        ],
      },
      {
        section: 'Fix and lesson',
        key: 'lastingFix',
        label: 'What lasting fix brought the node back and let the probe finish?',
        options: [
          {
            id: 'restore-threshold-restart-nm',
            label: 'Restored a sane disk-utilization threshold and restarted that NodeManager',
          },
          { id: 'disable-checker', label: 'Set yarn.nodemanager.disk-health-checker.enable to false' },
          { id: 'threshold-100', label: 'Set the utilization threshold to 100% so nothing ever flags' },
          { id: 'resubmit-only', label: 'Only killed and resubmitted the probe — left the node UNHEALTHY' },
        ],
      },
      {
        section: 'Fix and lesson',
        key: 'uiIsClaim',
        label: 'What is the RM / NM UI until you check the node?',
        options: [
          { id: 'verify-on-node', label: 'A claim — verify it with yarn / the node before you trust it' },
          { id: 'source-of-truth', label: 'Source of truth — the node can never disagree' },
          { id: 'optional', label: 'Optional decoration — ignore it for production work' },
          { id: 'spark-master', label: 'A Spark Master replacement on YARN' },
        ],
      },
    ],
  },
  'spark-11-land-in-the-right-capacity-queue': {
    intro:
      'Walk the incident in story order. Answers save as you go — Incomplete Investigation still fails on Submit.',
    steps: [
      {
        id: 'symptom',
        title: 'Morning job',
        blurb: 'What the ResourceManager showed when you opened the incident.',
        fieldKeys: ['stuckState', 'stuckQueue'],
      },
      {
        id: 'capacity',
        title: 'Capacity math',
        blurb: 'Why an app can sit Accepted forever even though the cluster is up.',
        fieldKeys: ['whyAccepted', 'productionSpare'],
      },
      {
        id: 'path',
        title: 'Lasting path',
        blurb: 'Where the wrong queue was baked in — and the lasting fix.',
        fieldKeys: ['wrongPath', 'lastingFix'],
      },
      {
        id: 'proof',
        title: 'Proof and lesson',
        blurb: 'The successful production run, and what queue placement is here.',
        fieldKeys: ['fixAppId', 'placementRule'],
      },
    ],
    fields: [
      {
        section: 'Morning job',
        key: 'stuckState',
        label: 'State of the morning store-rollup on the RM',
        options: [
          { id: 'ACCEPTED', label: 'ACCEPTED' },
          { id: 'RUNNING', label: 'RUNNING' },
          { id: 'FAILED', label: 'FAILED' },
          { id: 'FINISHED', label: 'FINISHED' },
        ],
      },
      {
        section: 'Morning job',
        key: 'stuckQueue',
        label: 'Queue that morning job was in',
        options: [
          { id: 'default', label: 'default' },
          { id: 'production', label: 'production' },
          { id: 'adhoc', label: 'adhoc' },
          { id: 'root', label: 'root (no leaf queue)' },
        ],
      },
      {
        section: 'Capacity math',
        key: 'whyAccepted',
        label: 'Why did that job stay Accepted instead of getting an ApplicationMaster?',
        options: [
          {
            id: 'ask-exceeds-default-share',
            label: 'Its resource ask did not fit default’s absolute share of the cluster',
          },
          { id: 'rm-down', label: 'The ResourceManager was down' },
          { id: 'no-nms', label: 'No NodeManagers were registered' },
          { id: 'bad-jar', label: 'The store_join.py job was missing from the image' },
        ],
      },
      {
        section: 'Capacity math',
        key: 'productionSpare',
        label: 'What did the production queue look like at the start of the incident?',
        options: [
          { id: 'has-room', label: 'Had spare capacity — room for this store-rollup shape' },
          { id: 'full', label: 'Completely full — another tenant owned every MB' },
          { id: 'stopped', label: 'Queue state was STOPPED' },
          { id: 'missing', label: 'The production queue did not exist' },
        ],
      },
      {
        section: 'Lasting path',
        key: 'wrongPath',
        label: 'Where was the wrong queue baked into the lasting submit path?',
        options: [
          { id: 'wrapper-queue-default', label: '~/lab/submit-store-rollup.sh still used --queue default' },
          { id: 'spark-defaults-only', label: 'Only spark-defaults.conf — the wrapper was already correct' },
          { id: 'rm-mapping', label: 'A queue-mappings rule forced every user into adhoc' },
          { id: 'no-wrong-path', label: 'Nothing on disk was wrong — only the one-off submit' },
        ],
      },
      {
        section: 'Lasting path',
        key: 'lastingFix',
        label: 'What lasting fix matched platform policy?',
        options: [
          {
            id: 'repair-wrapper-to-production',
            label: 'Repaired the wrapper to --queue production and re-ran it',
          },
          { id: 'raise-default', label: 'Raised default capacity in capacity-scheduler.xml until Accepted cleared' },
          { id: 'disable-cs', label: 'Switched off the CapacityScheduler' },
          { id: 'adhoc-once', label: 'One-off submit to adhoc — left the wrapper on default' },
        ],
      },
      {
        section: 'Proof and lesson',
        key: 'fixAppId',
        label: 'Successful application id in production',
        hint: 'application_… for the new run — not the morning Accepted id.',
      },
      {
        section: 'Proof and lesson',
        key: 'placementRule',
        label: 'What is queue placement on this platform?',
        options: [
          {
            id: 'platform-rule',
            label: 'A platform rule — the lasting submit path must match the queue policy',
          },
          { id: 'submitter-preference', label: 'A submitter preference — any queue is fine if the job finishes' },
          { id: 'raise-until-green', label: 'Whatever capacity edit makes the Scheduler look green' },
          { id: 'spark-ui-only', label: 'Something you only fix from the Spark History Server' },
        ],
      },
    ],
  },
  'spark-12-client-mode-driver-is-on-the-wrong-host': {
    intro:
      'Walk the stacked failure in story order. Answers save as you go — Incomplete Investigation still fails on Submit.',
    steps: [
      {
        id: 'overnight',
        title: 'Overnight failure',
        blurb: 'What died first, and why client mode made the edge host a single point of failure.',
        fieldKeys: ['failedAppId', 'failureMode'],
      },
      {
        id: 'second',
        title: 'Second break',
        blurb: 'After you move to cluster mode, what fails next — and where production data must live.',
        fieldKeys: ['secondBreak', 'dataPlacement'],
      },
      {
        id: 'proof',
        title: 'Proof',
        blurb: 'Successful cluster run and where the driver (AM) actually lived.',
        fieldKeys: ['clusterAppId', 'clusterDriverHost', 'productionShape'],
      },
    ],
    fields: [
      {
        section: 'Overnight failure',
        key: 'failedAppId',
        label: 'Failed overnight application id',
        hint: 'application_… from ~/lab/failed_app_id.',
      },
      {
        section: 'Overnight failure',
        key: 'failureMode',
        label: 'Why that overnight app died',
        options: [
          { id: 'driver-on-edge', label: 'Spark driver lived on shell (client mode) and that process went away' },
          { id: 'nm-crash', label: 'Both NodeManagers crashed together' },
          { id: 'bad-jar', label: 'The join job jar was missing' },
          { id: 'queue-full', label: 'The production queue was full' },
        ],
      },
      {
        section: 'Second break',
        key: 'secondBreak',
        label: 'After switching to cluster deploy mode alone, what broke next?',
        options: [
          {
            id: 'edge-path-on-nm',
            label: 'Driver on a NodeManager could not read shell-only ~/lab/edge-data paths',
          },
          { id: 'nothing', label: 'Nothing — cluster mode alone made the job finish' },
          { id: 'rm-down', label: 'The ResourceManager stopped accepting applications' },
          { id: 'queue-mapping', label: 'Queue mappings forced every submit into default' },
        ],
      },
      {
        section: 'Second break',
        key: 'dataPlacement',
        label: 'Where must production CSVs live so any NodeManager can open them?',
        options: [
          { id: 'shared-mount', label: '/mnt/lab-shared (cluster shared mount on every host)' },
          { id: 'shell-home', label: 'Only under /home/spark on shell' },
          { id: 'rm-only', label: 'Only on ds-spark-01 next to the ResourceManager' },
          { id: 'guess-nm', label: 'Copy to one NodeManager and hope the AM lands there' },
        ],
      },
      {
        section: 'Proof',
        key: 'clusterAppId',
        label: 'Successful cluster-mode application id',
        hint: 'New application_… — not the overnight failure.',
      },
      {
        section: 'Proof',
        key: 'clusterDriverHost',
        label: 'Where the cluster-mode driver (AM) ran',
        options: [
          { id: 'ds-spark-02', label: 'ds-spark-02' },
          { id: 'ds-spark-03', label: 'ds-spark-03' },
          { id: 'shell', label: 'shell' },
          { id: 'ds-spark-01', label: 'ds-spark-01' },
        ],
      },
      {
        section: 'Proof',
        key: 'productionShape',
        label: 'Production shape for unattended store-rollup',
        options: [
          {
            id: 'cluster-am',
            label: 'Cluster deploy mode — driver is a YARN ApplicationMaster container',
          },
          { id: 'client-shell', label: 'Client mode on the laptop/shell is fine for production' },
          { id: 'rm-host', label: 'Always pin the driver to the ResourceManager host' },
          { id: 'no-yarn', label: 'Skip YARN and use local[*]' },
        ],
      },
    ],
  },
  'spark-13-someone-elses-job-changed-yesterday': {
    intro:
      'Walk the design in story order: missing leaf → capacity math → refresh → proof. Answers save as you go — Incomplete Investigation still fails on Submit.',
    steps: [
      {
        id: 'failure',
        title: 'First failure',
        blurb: 'Why the analytics probe could not start on the cluster you inherited.',
        fieldKeys: ['firstFailure'],
      },
      {
        id: 'design',
        title: 'Design',
        blurb: 'What you changed in capacity-scheduler — and where the percent came from.',
        fieldKeys: ['designAction', 'capacitySource'],
      },
      {
        id: 'apply',
        title: 'Apply',
        blurb: 'How the live scheduler picked up the new leaf without borrowing another queue.',
        fieldKeys: ['applyMethod'],
      },
      {
        id: 'proof',
        title: 'Proof and lesson',
        blurb: 'Successful analytics run, and what platform engineering means here.',
        fieldKeys: ['fixedAppId', 'platformLesson'],
      },
    ],
    fields: [
      {
        section: 'First failure',
        key: 'firstFailure',
        label: 'Why did the first analytics-probe submit fail?',
        options: [
          {
            id: 'queue-missing',
            label: 'The analytics leaf queue did not exist on the CapacityScheduler',
          },
          { id: 'production-full', label: 'production was saturated by a backfill' },
          { id: 'rm-down', label: 'The ResourceManager was down' },
          { id: 'bad-jar', label: 'store_join.py was missing from the image' },
        ],
      },
      {
        section: 'Design',
        key: 'designAction',
        label: 'What lasting scheduler change did you make?',
        options: [
          {
            id: 'add-analytics-rebalance',
            label:
              'Added an analytics leaf, rebalanced siblings to 100, and set user-limit-factor ≥ 2 with max-capacity 100',
          },
          { id: 'point-production', label: 'Pointed the probe at production and left the scheduler alone' },
          { id: 'raise-default', label: 'Raised default capacity until any submit looked green' },
          { id: 'delete-production', label: 'Deleted production so analytics could take 70%' },
        ],
      },
      {
        section: 'Design',
        key: 'capacitySource',
        label: 'Where did analytics capacity come from?',
        options: [
          {
            id: 'rebalance-siblings',
            label: 'Rebalanced existing sibling queues (for example trimmed adhoc) so the root still sums to 100',
          },
          { id: 'print-extra', label: 'Printed extra percent on top of 10+70+20 without rebalancing' },
          { id: 'steal-prod-job', label: 'Stole capacity by killing someone else’s ApplicationMaster' },
          { id: 'no-capacity', label: 'Gave analytics 0% capacity — name only' },
        ],
      },
      {
        section: 'Apply',
        key: 'applyMethod',
        label: 'How did you apply the new queue on the live cluster?',
        options: [
          {
            id: 'refresh-queues',
            label: 'Edited capacity-scheduler.xml on the RM host and ran yarn rmadmin -refreshQueues',
          },
          { id: 'shell-only-xml', label: 'Edited XML only on shell — ResourceManager never saw it' },
          { id: 'spark-defaults', label: 'Only changed spark-defaults.conf on the client' },
          { id: 'kill-rm', label: 'Deleted the ResourceManager process and hoped pods respawned the queue' },
        ],
      },
      {
        section: 'Proof and lesson',
        key: 'fixedAppId',
        label: 'Successful analytics-probe application id',
        hint: 'application_… that ran in the analytics queue.',
      },
      {
        section: 'Proof and lesson',
        key: 'platformLesson',
        label: 'What is the platform lesson in this lab?',
        options: [
          {
            id: 'design-not-borrow',
            label: 'Design the queue the team needs — do not borrow another tenant’s lane',
          },
          { id: 'any-queue', label: 'Any queue is fine if the job eventually finishes' },
          { id: 'ui-only', label: 'Queue design is only a Spark UI checkbox' },
          { id: 'raise-until-green', label: 'Always raise default capacity until Accepted clears' },
        ],
      },
    ],
  },
  'spark-15-driver-and-executor-pods-on-kubernetes': {
    intro:
      'Map Kubernetes as the resource manager, finish the submit wrapper, watch driver/executor pods, and record what happens when you kill an executor.',
    steps: [
      {
        id: 'forensics',
        title: 'Forensics',
        blurb: 'Same job as Chapters 1–2 — the resource manager changed again.',
        fieldKeys: ['resourceManager', 'deployMode'],
      },
      {
        id: 'pods',
        title: 'Pods',
        blurb: 'After a successful run (and optional executor kill), what did you observe?',
        fieldKeys: ['killExecutor'],
      },
    ],
    fields: [
      {
        section: 'Forensics',
        key: 'resourceManager',
        label: 'What schedules the driver and executor processes in this lab?',
        options: [
          { id: 'k8s', label: 'The Kubernetes API (pods in the team namespace)' },
          { id: 'yarn', label: 'YARN ResourceManager / NodeManagers' },
          { id: 'master', label: 'A Spark Master on ds-spark-01' },
          { id: 'shell', label: 'Only the shell process — no cluster scheduler' },
        ],
      },
      {
        section: 'Forensics',
        key: 'deployMode',
        label: 'Which deploy mode does the planted wrapper use?',
        options: [
          { id: 'cluster', label: 'cluster — driver runs as a pod in the namespace' },
          { id: 'client', label: 'client — driver stays on the shell' },
          { id: 'local', label: 'local[*] — no Kubernetes' },
          { id: 'yarn', label: 'yarn — YARN ApplicationMaster' },
        ],
      },
      {
        section: 'Pods',
        key: 'killExecutor',
        label: 'After you delete one running executor pod, what should happen?',
        options: [
          {
            id: 'replaced',
            label: 'Spark schedules a replacement executor pod without a resubmit',
          },
          { id: 'must-resubmit', label: 'You must spark-submit again or the job is stuck forever' },
          { id: 'driver-dies', label: 'The driver pod is always deleted with the executor' },
          { id: 'namespace-wiped', label: 'Kubernetes deletes the whole namespace' },
        ],
      },
    ],
  },
  'spark-16-namespace-quota-blocks-the-submit': {
    intro:
      'A ResourceQuota plus leftover debug-memory-hog block the driver. Free the quota without deleting the quota object.',
    steps: [
      {
        id: 'blocker',
        title: 'Blocker',
        blurb: 'What is preventing the driver from starting?',
        fieldKeys: ['blocker'],
      },
      {
        id: 'fix',
        title: 'Fix',
        blurb: 'Which operational fix did you apply?',
        fieldKeys: ['fix'],
      },
    ],
    fields: [
      {
        section: 'Blocker',
        key: 'blocker',
        label: 'What is blocking store-rollup-quota?',
        options: [
          { id: 'quota-hog', label: 'Namespace ResourceQuota + leftover debug-memory-hog' },
          { id: 'no-nodes', label: 'No spark pool nodes exist' },
          { id: 'bad-jar', label: 'Missing JAR on the image' },
          { id: 'yarn-queue', label: 'YARN capacity queue is full' },
        ],
      },
      {
        section: 'Fix',
        key: 'fix',
        label: 'How did you free capacity for the submit?',
        options: [
          { id: 'delete-hog', label: 'Deleted debug-memory-hog and kept team-spark-quota' },
          { id: 'use-prod', label: 'Retargeted the submit at the prod namespace' },
          { id: 'delete-quota', label: 'Deleted the ResourceQuota object' },
          { id: 'raise-cluster', label: 'Raised a cluster-wide memory limit' },
        ],
      },
    ],
  },
  'spark-17-wrong-image-missing-dependency': {
    intro:
      'On Kubernetes the image is the environment. Base apache/spark is missing the team module; platform policy requires a pull secret on the team image.',
    steps: [
      {
        id: 'failure',
        title: 'Failure',
        blurb: 'What failed in the driver/executor logs?',
        fieldKeys: ['failure'],
      },
      {
        id: 'fix',
        title: 'Fix',
        blurb: 'What did you change in the wrapper?',
        fieldKeys: ['fix'],
      },
    ],
    fields: [
      {
        section: 'Failure',
        key: 'failure',
        label: 'Why did the job fail on the base image?',
        options: [
          {
            id: 'missing-module',
            label: 'Team job/module missing from the base image (image is the environment)',
          },
          { id: 'quota', label: 'ResourceQuota blocked the driver' },
          { id: 'dns', label: 'CoreDNS was down' },
          { id: 'yarn', label: 'YARN ApplicationMaster crashed' },
        ],
      },
      {
        section: 'Fix',
        key: 'fix',
        label: 'What fixed the submit?',
        options: [
          {
            id: 'team-image-pullsecret',
            label: 'Team lab image + spark.kubernetes.container.image.pullSecrets',
          },
          { id: 'hostpath-jars', label: 'Mounted $SPARK_HOME/jars from the node hostPath' },
          { id: 'delete-quota', label: 'Deleted the ResourceQuota' },
          { id: 'client-mode', label: 'Switched to client deploy mode only' },
        ],
      },
    ],
  },
  'spark-18-dynamic-allocation-without-the-shuffle-service': {
    intro:
      'Dynamic Allocation without an External Shuffle Service loses shuffle blocks when executors scale down.',
    steps: [
      {
        id: 'cause',
        title: 'Root cause',
        blurb: 'Why did shuffle fetch fail?',
        fieldKeys: ['rootCause'],
      },
      {
        id: 'fix',
        title: 'Fix',
        blurb: 'Which app-level workaround did you apply?',
        fieldKeys: ['fix'],
      },
    ],
    fields: [
      {
        section: 'Root cause',
        key: 'rootCause',
        label: 'What caused the shuffle fetch failure?',
        options: [
          {
            id: 'dyn-alloc-no-ess',
            label: 'Dynamic Allocation enabled without an External Shuffle Service',
          },
          { id: 'wrong-image', label: 'Wrong container image' },
          { id: 'quota', label: 'ResourceQuota blocked executors' },
          { id: 'oom', label: 'Driver OOMKilled only' },
        ],
      },
      {
        section: 'Fix',
        key: 'fix',
        label: 'What did you change for this lab’s graded path?',
        options: [
          {
            id: 'disable-dyn-alloc',
            label: 'Disabled dynamic allocation and set static executor instances',
          },
          { id: 'privileged-ds', label: 'Installed a privileged ESS DaemonSet on every node' },
          { id: 'delete-ns', label: 'Deleted the team namespace' },
          { id: 'raise-quota', label: 'Raised ResourceQuota only' },
        ],
      },
    ],
  },
  'spark-19-driver-oomkilled-spark-memory-vs-k8s-limits': {
    intro:
      'Spark driver heap is only part of the container. Align memoryOverhead with the Kubernetes memory limit.',
    steps: [
      {
        id: 'symptom',
        title: 'Symptom',
        blurb: 'What did kubectl show on the driver pod?',
        fieldKeys: ['symptom'],
      },
      {
        id: 'fix',
        title: 'Fix',
        blurb: 'How did you align Spark and K8s memory?',
        fieldKeys: ['fix'],
      },
    ],
    fields: [
      {
        section: 'Symptom',
        key: 'symptom',
        label: 'How was the driver terminated?',
        options: [
          { id: 'oomkilled', label: 'OOMKilled — container exceeded its memory limit' },
          { id: 'evicted', label: 'Evicted for disk pressure only' },
          { id: 'imagepull', label: 'ImagePullBackOff' },
          { id: 'quota', label: 'ResourceQuota Forbidden only' },
        ],
      },
      {
        section: 'Fix',
        key: 'fix',
        label: 'What fixed the OOMKilled driver?',
        options: [
          {
            id: 'overhead-and-limit',
            label: 'Set driver memoryOverhead and raised kubernetes.kubernetes.driver.limit.memory',
          },
          { id: 'disable-dyn', label: 'Disabled dynamic allocation only' },
          { id: 'wrong-ns', label: 'Switched namespaces only' },
          { id: 'more-executors', label: 'Added more executor instances only' },
        ],
      },
    ],
  },
  'spark-20-multi-fault-k8s-submit': {
    intro:
      'Three faults after maintenance. Record the order you peeled: namespace, then image, then memory.',
    steps: [
      {
        id: 'layers',
        title: 'Layers',
        blurb: 'Which fault appeared first, second, and third?',
        fieldKeys: ['layer1', 'layer2', 'layer3'],
      },
    ],
    fields: [
      {
        section: 'Layers',
        key: 'layer1',
        label: 'First fault (driver never starts / quota)?',
        options: [
          { id: 'namespace', label: 'Wrong / blocked namespace (staging)' },
          { id: 'image', label: 'Wrong image / missing module' },
          { id: 'memory', label: 'Executor memory under-spec’d' },
          { id: 'shuffle', label: 'Dynamic allocation shuffle only' },
        ],
      },
      {
        section: 'Layers',
        key: 'layer2',
        label: 'Second fault (after namespace is correct)?',
        options: [
          { id: 'image', label: 'Wrong image / missing module (+ pullSecrets)' },
          { id: 'namespace', label: 'Wrong namespace again' },
          { id: 'memory', label: 'Executor memory under-spec’d' },
          { id: 'shuffle', label: 'Dynamic allocation shuffle only' },
        ],
      },
      {
        section: 'Layers',
        key: 'layer3',
        label: 'Third fault (executors die during shuffle)?',
        options: [
          { id: 'memory', label: 'Executor memory under-spec’d (overhead + limit)' },
          { id: 'namespace', label: 'Wrong namespace' },
          { id: 'image', label: 'Wrong image' },
          { id: 'shuffle', label: 'Dynamic allocation shuffle only' },
        ],
      },
    ],
  },
};

export function sparkInvestigation(challengeId: string): SparkInvestigationSpec | null {
  return SPARK_INVESTIGATIONS[challengeId] || null;
}

export function emptyInvestigation(challengeId: string): Record<string, string> {
  const value: Record<string, string> = {};
  sparkInvestigation(challengeId)?.fields.forEach((field) => {
    value[field.key] = '';
  });
  return value;
}

export function investigationComplete(value: Record<string, string>): boolean {
  const fields = Object.values(value);
  return fields.length > 0 && fields.every((field) => field.trim() !== '');
}

export function loadInvestigation(challengeId: string): Record<string, string> {
  const next = emptyInvestigation(challengeId);
  try {
    const raw = sessionStorage.getItem(`devlabs.investigation.${challengeId}`);
    if (!raw) return next;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    Object.keys(next).forEach((key) => {
      if (typeof parsed[key] === 'string') next[key] = parsed[key];
    });
  } catch {
    /* a broken saved form just starts empty */
  }
  return next;
}

export function saveInvestigation(challengeId: string, value: Record<string, string>): void {
  try {
    sessionStorage.setItem(`devlabs.investigation.${challengeId}`, JSON.stringify(value));
  } catch {
    /* the form still works for this page load */
  }
}

function sectionsOf(spec: SparkInvestigationSpec): Array<{ title: string; fields: SparkInvestigationField[] }> {
  const sections: Array<{ title: string; fields: SparkInvestigationField[] }> = [];
  spec.fields.forEach((field) => {
    const last = sections[sections.length - 1];
    if (!last || last.title !== field.section) sections.push({ title: field.section, fields: [field] });
    else last.fields.push(field);
  });
  return sections;
}

function fieldFilled(value: Record<string, string>, key: string): boolean {
  return String(value[key] || '').trim() !== '';
}

function InvestigationFields({
  fields,
  value,
  onChange,
}: {
  fields: SparkInvestigationField[];
  value: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
}): JSX.Element {
  const set = (key: string) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    onChange({ ...value, [key]: event.target.value });
  };
  return (
    <>
      {fields.map((field) => (
        <label className="k8s-lab-investigation-field" key={field.key}>
          <span>{field.label}</span>
          <em>{field.hint || ''}</em>
          {field.options?.length ? (
            <select value={value[field.key] || ''} onChange={set(field.key)}>
              <option value="">Select one…</option>
              {field.options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : (
            <input value={value[field.key] || ''} onChange={set(field.key)} autoComplete="off" />
          )}
        </label>
      ))}
    </>
  );
}

function WizardInvestigationForm({
  spec,
  value,
  onChange,
}: {
  spec: SparkInvestigationSpec;
  value: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
}): JSX.Element {
  const steps = spec.steps || [];
  const byKey = useMemo(() => {
    const map = new Map<string, SparkInvestigationField>();
    spec.fields.forEach((field) => map.set(field.key, field));
    return map;
  }, [spec.fields]);

  const [stepIndex, setStepIndex] = useState(0);
  const safeIndex = Math.min(Math.max(stepIndex, 0), Math.max(steps.length - 1, 0));
  const step = steps[safeIndex];
  const stepFields = (step?.fieldKeys || [])
    .map((key) => byKey.get(key))
    .filter((field): field is SparkInvestigationField => Boolean(field));

  const stepDone = stepFields.every((field) => fieldFilled(value, field.key));
  const doneCount = steps.filter((s) =>
    s.fieldKeys.every((key) => fieldFilled(value, key)),
  ).length;

  return (
    <form
      className="k8s-lab-investigation-form k8s-lab-investigation-form--wizard"
      onSubmit={(event) => event.preventDefault()}
    >
      <p>{spec.intro}</p>

      <nav className="k8s-lab-investigation-steps" aria-label="Investigation pages">
        {steps.map((s, index) => {
          const complete = s.fieldKeys.every((key) => fieldFilled(value, key));
          return (
            <React.Fragment key={s.id}>
              {index > 0 ? <span className="k8s-lab-investigation-step-arrow" aria-hidden="true">→</span> : null}
              <button
                type="button"
                className={
                  `k8s-lab-investigation-step`
                  + (index === safeIndex ? ' is-current' : '')
                  + (complete ? ' is-complete' : '')
                }
                onClick={() => setStepIndex(index)}
                aria-label={s.title}
                aria-current={index === safeIndex ? 'step' : undefined}
                title={s.title}
              >
                <span className="k8s-lab-investigation-step-num">{index + 1}</span>
              </button>
            </React.Fragment>
          );
        })}
      </nav>

      <div className="k8s-lab-investigation-step-panel">
        <header className="k8s-lab-investigation-step-head">
          <h3>{step?.title}</h3>
          {step?.blurb ? <p>{step.blurb}</p> : null}
        </header>
        <section>{stepFields.length ? (
          <InvestigationFields fields={stepFields} value={value} onChange={onChange} />
        ) : null}</section>
      </div>

      <footer className="k8s-lab-investigation-wizard-nav">
        <button
          type="button"
          className="k8s-lab-investigation-wizard-btn"
          disabled={safeIndex <= 0}
          onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
        >
          Back
        </button>
        <span className="k8s-lab-investigation-wizard-status">
          {doneCount}/{steps.length} pages filled
          {stepDone ? '' : ' · finish this page to keep going'}
        </span>
        {safeIndex < steps.length - 1 ? (
          <button
            type="button"
            className="k8s-lab-investigation-wizard-btn is-primary"
            disabled={!stepDone}
            onClick={() => setStepIndex((i) => Math.min(steps.length - 1, i + 1))}
          >
            Next
          </button>
        ) : (
          <span className={`k8s-lab-investigation-wizard-done${doneCount === steps.length ? ' is-ready' : ''}`}>
            {doneCount === steps.length ? 'Ready to Submit' : 'Last page'}
          </span>
        )}
      </footer>
    </form>
  );
}

export default function SparkInvestigationForm({
  spec,
  value,
  onChange,
}: {
  spec: SparkInvestigationSpec;
  value: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
}): JSX.Element {
  if (spec.steps?.length) {
    return <WizardInvestigationForm spec={spec} value={value} onChange={onChange} />;
  }

  return (
    <form className="k8s-lab-investigation-form" onSubmit={(event) => event.preventDefault()}>
      <p>{spec.intro}</p>
      {sectionsOf(spec).map((section) => (
        <section key={section.title}>
          <h3>{section.title}</h3>
          <InvestigationFields fields={section.fields} value={value} onChange={onChange} />
        </section>
      ))}
    </form>
  );
}
