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
      'Find both causes before any fix. Incomplete Investigation fails on Submit. Raising memory alone is not enough.',
    fields: [
      { section: 'Symptom', key: 'lossPattern', label: 'What you saw when executors were lost', hint: 'Driver / UI wording.' },
      {
        section: 'Cause A — sizing',
        key: 'undersizedEvidence',
        label: 'Undersized executor — evidence',
        hint: 'Requested memory vs worker capacity.',
      },
      {
        section: 'Cause B — colocation',
        key: 'cotenantApp',
        label: 'Second job / app sharing the worker',
        hint: 'Application name or id.',
      },
      { section: 'Cause B — colocation', key: 'sharedWorker', label: 'Worker host they shared' },
      {
        section: 'Fix',
        key: 'fixSummary',
        label: 'What you changed so both causes are addressed',
      },
    ],
  },
  'spark-07-the-capstone-bug-slow-then-dead': {
    intro:
      'Read a timeline, not a snapshot. Cite at least three signals. Incomplete Investigation fails on Submit.',
    fields: [
      { section: 'Timeline', key: 'whenHealthy', label: 'When it was still healthy', hint: 'Rough clock or stage.' },
      { section: 'Timeline', key: 'whenSlow', label: 'When it slowed' },
      { section: 'Timeline', key: 'whenDead', label: 'When the executor died' },
      { section: 'Signals', key: 'signalMasterUi', label: 'Signal from the Master UI' },
      { section: 'Signals', key: 'signalWorkerLog', label: 'Signal from a worker log' },
      { section: 'Signals', key: 'signalExecutorMem', label: 'Signal from executor memory breakdown' },
      {
        section: 'Cause',
        key: 'rootCause',
        label: 'Root cause (one sentence)',
        hint: 'Memory-leak-shaped caching / retention — be specific.',
      },
      { section: 'Fix', key: 'fixSummary', label: 'What you changed' },
    ],
  },
  'spark-08-drain-a-worker-without-breaking-anything': {
    intro:
      'Drain ds-spark-03 without task failures, then prove you did not recreate the Lab 1.6 overcommit on ds-spark-02. Incomplete Investigation fails on Submit.',
    fields: [
      {
        section: 'Drain',
        key: 'drainSteps',
        label: 'How you drained ds-spark-03',
      },
      { section: 'Drain', key: 'taskFailures', label: 'Task failures during the drain' },
      {
        section: 'After',
        key: 'relocationHosts',
        label: 'Where relocated executors landed',
      },
      {
        section: 'Overcommit check',
        key: 'overcommitCheck',
        label: 'Did this recreate the Lab 1.6 overcommit on ds-spark-02?',
      },
      {
        section: 'Guardrail',
        key: 'concentrationLimit',
        label: 'Concentration limit or placement rule you enforced',
      },
    ],
  },
  'spark-09-submit-the-same-workload-on-yarn': {
    intro:
      'Submit the same join once in client mode and once in cluster mode. Record where the driver lived and which RM / NM panels showed the app. Incomplete Investigation fails on Submit.',
    fields: [
      {
        section: 'Client mode',
        key: 'clientAppId',
        label: 'Client-mode application id',
        hint: 'application_… from yarn application -list or the RM UI.',
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
        key: 'clientContainerHosts',
        label: 'Hosts that held client-mode containers',
        hint: 'e.g. ds-spark-02, ds-spark-03 — from RM or NM panels.',
      },
      {
        section: 'Client mode',
        key: 'clientAllocMemory',
        label: 'Allocated memory the RM showed for that app',
        hint: 'MB or the UI string — include units if the panel shows them.',
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
        hint: 'A second application_… — not the client-mode id.',
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
        key: 'clusterContainerHosts',
        label: 'Hosts that held cluster-mode containers',
        hint: 'Include the AM host if you can see it.',
      },
      {
        section: 'Cluster mode',
        key: 'clusterAllocMemory',
        label: 'Allocated memory the RM showed for that app',
      },
      {
        section: 'Compare',
        key: 'deployModeDelta',
        label: 'What changed between client and cluster mode?',
        options: [
          { id: 'driver-host', label: 'The driver moved from the shell into a YARN container (AM)' },
          { id: 'executor-count', label: 'Cluster mode always gets twice as many executors' },
          { id: 'no-rm', label: 'Cluster mode bypasses the ResourceManager' },
          { id: 'master-back', label: 'Cluster mode starts a Spark Master again' },
        ],
      },
    ],
  },
  'spark-10-read-the-rm-and-nm-as-instruments': {
    intro:
      'Read the planted probe app from the RM / NM UIs, then verify two claims on a node. Incomplete Investigation fails on Submit.',
    fields: [
      {
        section: 'RM cluster',
        key: 'activeNodes',
        label: 'Active NodeManagers the RM shows',
        options: [
          { id: '0', label: '0' },
          { id: '1', label: '1' },
          { id: '2', label: '2' },
          { id: '3', label: '3' },
        ],
      },
      {
        section: 'RM cluster',
        key: 'availableMb',
        label: 'Available MB the RM reports for the cluster',
        hint: 'Integer from cluster metrics / scheduler overview — no units suffix.',
      },
      {
        section: 'Probe app',
        key: 'probeAppId',
        label: 'Probe application id',
        hint: 'application_… for store-rollup-probe.',
      },
      {
        section: 'Probe app',
        key: 'probeAppState',
        label: 'Probe application final state on the RM',
        options: [
          { id: 'FINISHED', label: 'FINISHED' },
          { id: 'RUNNING', label: 'RUNNING' },
          { id: 'ACCEPTED', label: 'ACCEPTED' },
          { id: 'FAILED', label: 'FAILED' },
        ],
      },
      {
        section: 'Containers',
        key: 'containerNmHost',
        label: 'A NodeManager host that held a container for the probe',
        options: [
          { id: 'ds-spark-02', label: 'ds-spark-02' },
          { id: 'ds-spark-03', label: 'ds-spark-03' },
          { id: 'ds-spark-01', label: 'ds-spark-01 (ResourceManager host)' },
          { id: 'shell', label: 'shell' },
        ],
      },
      {
        section: 'Cross-check',
        key: 'crossCheck',
        label: 'How did you verify two UI claims on a node?',
        options: [
          { id: 'yarn-logs-or-nm-local', label: 'yarn logs / yarn application -status and/or NM local log dirs' },
          { id: 'history-only', label: 'Spark History Server on 18080 only' },
          { id: 'master-ui', label: 'Standalone Master UI on 8080' },
          { id: 'guessed', label: 'Trusted the browser — no node check' },
        ],
      },
      {
        section: 'Cross-check',
        key: 'uiIsClaim',
        label: 'What is the RM/NM UI until you check the node?',
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
      'store-rollup sits Accepted in the wrong queue. Place it in production without raising default capacity. Incomplete Investigation fails on Submit.',
    fields: [
      {
        section: 'Symptom',
        key: 'stuckState',
        label: 'State of the stuck submit on the RM',
        options: [
          { id: 'ACCEPTED', label: 'ACCEPTED' },
          { id: 'RUNNING', label: 'RUNNING' },
          { id: 'FAILED', label: 'FAILED' },
          { id: 'NEW', label: 'NEW' },
        ],
      },
      {
        section: 'Symptom',
        key: 'wrongQueue',
        label: 'Queue the stuck app was in',
        options: [
          { id: 'default', label: 'default' },
          { id: 'production', label: 'production' },
          { id: 'root', label: 'root' },
          { id: 'spark', label: 'spark' },
        ],
      },
      {
        section: 'Fix',
        key: 'fixQueue',
        label: 'Queue you used for the successful run',
        options: [
          { id: 'production', label: 'production' },
          { id: 'default', label: 'default (raised its capacity)' },
          { id: 'adhoc', label: 'adhoc' },
          { id: 'none', label: 'No queue — bypassed YARN' },
        ],
      },
      {
        section: 'Fix',
        key: 'fixAppId',
        label: 'Successful application id',
        hint: 'application_… that reached RUNNING/FINISHED in production.',
      },
      {
        section: 'Lesson',
        key: 'placementRule',
        label: 'What fixed the Accepted stall?',
        options: [
          { id: 'queue-placement', label: 'Queue placement — submit into the queue with spare capacity' },
          { id: 'raise-default', label: 'Raising default queue capacity until it looked green' },
          { id: 'more-executors', label: 'Asking for more executors so YARN takes it seriously' },
          { id: 'kill-rm', label: 'Restarting the ResourceManager' },
        ],
      },
    ],
  },
  'spark-12-client-mode-driver-is-on-the-wrong-host': {
    intro:
      'Client-mode driver on the edge (shell) dies mid-job. Resubmit in cluster mode so the driver is a YARN AM. Incomplete Investigation fails on Submit.',
    fields: [
      {
        section: 'Failure',
        key: 'failedAppId',
        label: 'Failed client-mode application id',
        hint: 'The planted edge-driver run that died when the shell driver was killed.',
      },
      {
        section: 'Failure',
        key: 'failureMode',
        label: 'Why the client-mode app died',
        options: [
          { id: 'driver-on-edge', label: 'Driver lived on the shell/edge host and that process went away' },
          { id: 'nm-crash', label: 'Both NodeManagers crashed together' },
          { id: 'bad-jar', label: 'The join job jar was missing' },
          { id: 'queue-full', label: 'The production queue was full' },
        ],
      },
      {
        section: 'Fix',
        key: 'clusterAppId',
        label: 'Successful cluster-mode application id',
      },
      {
        section: 'Fix',
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
        section: 'Lesson',
        key: 'productionShape',
        label: 'Production shape for the driver',
        options: [
          { id: 'cluster-am', label: 'Cluster deploy mode — driver is a YARN ApplicationMaster container' },
          { id: 'client-shell', label: 'Client mode on the laptop/shell is fine for production' },
          { id: 'rm-host', label: 'Always pin the driver to the ResourceManager host' },
          { id: 'no-yarn', label: 'Skip YARN and use local[*]' },
        ],
      },
    ],
  },
  'spark-13-someone-elses-job-changed-yesterday': {
    intro:
      'Your submit sits Accepted because another team’s backfill took the queue. Free capacity or move queues without an unauthorized AM kill. Incomplete Investigation fails on Submit.',
    fields: [
      {
        section: 'Symptom',
        key: 'stuckState',
        label: 'State of your stalled submit',
        options: [
          { id: 'ACCEPTED', label: 'ACCEPTED' },
          { id: 'RUNNING', label: 'RUNNING' },
          { id: 'FAILED', label: 'FAILED' },
          { id: 'KILLED', label: 'KILLED' },
        ],
      },
      {
        section: 'Cause',
        key: 'blockerApp',
        label: 'Application that was holding the queue',
        hint: 'application_… for the planted backfill (name contains backfill).',
      },
      {
        section: 'Fix',
        key: 'fixPath',
        label: 'How you got a RUNNING/FINISHED run',
        options: [
          { id: 'other-queue', label: 'Submitted into a queue with spare capacity' },
          { id: 'freed-capacity', label: 'Freed capacity from the backfill without an unauthorized AM kill' },
          { id: 'killed-am', label: 'Killed the backfill AM even though the ticket forbade it' },
          { id: 'raised-cap', label: 'Raised the saturated queue’s capacity in capacity-scheduler.xml' },
        ],
      },
      {
        section: 'Fix',
        key: 'fixedAppId',
        label: 'Your successful application id',
      },
      {
        section: 'Lesson',
        key: 'yesterdayLesson',
        label: 'Why “it worked yesterday” misleads',
        options: [
          { id: 'other-tenant', label: 'Another tenant’s job changed the queue’s free capacity overnight' },
          { id: 'spark-bug', label: 'Spark always breaks after 24 hours' },
          { id: 'dns', label: 'The ResourceManager hostname rotated' },
          { id: 'image', label: 'The lab image deleted yarn-site.xml' },
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
