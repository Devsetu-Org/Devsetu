/** Play catalog taxonomy (sidebar filters + ordered challenge ids). */

import { SPARK_PLAYGROUND_CHALLENGE_ID } from './playgroundDatasets';
import { whiteboardSectionForTags, whiteboardSectionPath } from './whiteboard';

export type PlayDomainId =
  | 'data-engineer'
  | 'software-engineer'
  | 'devops-engineer'
  | 'platforms-engineer'
  | 'distributed-systems-engineer';

export type PlayPanelId = string;

/** One lab row inside a chapter card. Pack labs use challengeId; planned labs are title-only. */
export type PlayChapterLab =
  | {
      challengeId: string;
      /** Green “Free” mark on the chapter shelf (display only until billing covers Spark). */
      free?: boolean;
    }
  | {
      title: string;
      /** Planned lab with no pack yet — shown locked on the chapter shelf. */
      placeholder: true;
    }
  | {
      title: string;
      /** Coding-minor lab: opens `/minors/{minorId}/{chapterId}` (not a VM pack). */
      minorId: string;
      chapterId: string;
      /** Optional task id (e.g. `1.1`) — workspace opens Tasks with that TODO expanded. */
      taskId?: string;
      free?: boolean;
    };

export interface PlayChapter {
  id: string;
  /** Small label above the title, e.g. "Chapter 1". */
  kicker: string;
  title: string;
  /** Blog slug on this panel's reading track. The shelf links it above the labs. */
  readingSlug?: string;
  labs: PlayChapterLab[];
}

export interface PlayPanel {
  id: PlayPanelId;
  label: string;
  blurb: string;
  /** Green one-liner on a shelf tile. */
  subtitle?: string;
  /** Grey brief on a shelf tile. The page header still uses blurb. */
  tileBlurb?: string;
  /** Challenge ids shown under this panel (order preserved). */
  challengeIds: string[];
  /**
   * Optional chapter cards for the panel shelf. When set, Play renders a
   * chapter grid instead of the flat lab table. challengeIds still drives
   * catalog membership and must list every pack lab in the chapters.
   */
  chapters?: PlayChapter[];
}

export interface PlayDomain {
  id: PlayDomainId;
  label: string;
  blurb: string;
  panels: PlayPanel[];
  /** Listed as Soon and not browsable, even if it has labs. */
  comingSoon?: boolean;
}

export const PLAY_DOMAINS: PlayDomain[] = [
  {
    id: 'devops-engineer',
    label: 'DevOps Engineer',
    blurb:
      'How companies ship and operate software. Practice on Linux, containers, and Kubernetes.',
    panels: [
      {
        id: 'linux',
        label: 'Linux',
        subtitle: 'A machine of your own, with sudo',
        tileBlurb:
          'Files, users, and permissions on a box you control. Then processes, services that restart themselves, disks, the network, and a script for the health check.',
        blurb: 'Your own Linux machine with sudo: the shell, text tools, users and permissions, processes, systemd, storage, networking, SSH and bash scripting.',
        challengeIds: [
          'linux-00-first-shift-on-the-order-box',
          'linux-01-organize-the-release-folder',
          'linux-02-find-the-misplaced-configs',
          'linux-03-read-the-order-logs',
          'linux-04-grep-the-failed-payments',
          'linux-05-pipeline-for-the-daily-order-report',
          'linux-06-fix-the-config-with-sed-and-vim',
          'linux-07-onboard-the-payments-team',
          'linux-08-lock-down-payment-secrets',
          'linux-09-shared-drop-folder-for-notifications',
          'linux-10-hunt-the-runaway-process',
          'linux-11-keep-the-batch-running-after-logout',
          'linux-12-run-order-processor-as-a-service',
          'linux-13-restart-on-crash-start-in-order',
          'linux-14-debug-a-failing-unit',
          'linux-15-nightly-reconciliation',
          'linux-16-rotate-notification-logs',
          'linux-18-disk-full-on-the-order-box',
          'linux-19-archive-and-roll-back-releases',
          'linux-20-why-cant-order-reach-payment',
          'linux-23-script-the-health-check',
          'linux-24-loop-over-order-batches',
          'linux-25-order-box-incident',
        ],
        chapters: [
          {
            id: 'files-and-text',
            kicker: 'Chapter 1',
            title: 'Files and Text',
            labs: [
              { challengeId: 'linux-00-first-shift-on-the-order-box' },
              { challengeId: 'linux-01-organize-the-release-folder' },
              { challengeId: 'linux-02-find-the-misplaced-configs' },
              { challengeId: 'linux-03-read-the-order-logs' },
              { challengeId: 'linux-04-grep-the-failed-payments' },
              { challengeId: 'linux-05-pipeline-for-the-daily-order-report' },
              { challengeId: 'linux-06-fix-the-config-with-sed-and-vim' },
            ],
          },
          {
            id: 'users-and-permissions',
            kicker: 'Chapter 2',
            title: 'Users and Permissions',
            labs: [
              { challengeId: 'linux-07-onboard-the-payments-team' },
              { challengeId: 'linux-08-lock-down-payment-secrets' },
              { challengeId: 'linux-09-shared-drop-folder-for-notifications' },
            ],
          },
          {
            id: 'processes-and-services',
            kicker: 'Chapter 3',
            title: 'Processes and Services',
            labs: [
              { challengeId: 'linux-10-hunt-the-runaway-process' },
              { challengeId: 'linux-11-keep-the-batch-running-after-logout' },
              { challengeId: 'linux-12-run-order-processor-as-a-service' },
              { challengeId: 'linux-13-restart-on-crash-start-in-order' },
              { challengeId: 'linux-14-debug-a-failing-unit' },
              { challengeId: 'linux-15-nightly-reconciliation' },
              { challengeId: 'linux-16-rotate-notification-logs' },
            ],
          },
          {
            id: 'disks-and-releases',
            kicker: 'Chapter 4',
            title: 'Disks and Releases',
            labs: [
              { challengeId: 'linux-18-disk-full-on-the-order-box' },
              { challengeId: 'linux-19-archive-and-roll-back-releases' },
            ],
          },
          {
            id: 'network-and-access',
            kicker: 'Chapter 5',
            title: 'Network and Access',
            labs: [{ challengeId: 'linux-20-why-cant-order-reach-payment' }],
          },
          {
            id: 'scripts-and-incidents',
            kicker: 'Chapter 6',
            title: 'Scripts and Incidents',
            labs: [
              { challengeId: 'linux-23-script-the-health-check' },
              { challengeId: 'linux-24-loop-over-order-batches' },
              { challengeId: 'linux-25-order-box-incident' },
            ],
          },
        ],
      },
      {
        id: 'docker',
        label: 'Docker',
        subtitle: 'Containers on your own machine',
        tileBlurb:
          'Start a container, then build the image yourself. Pass in config, keep the data, join a network, bring the whole stack up, and roll a bad release back.',
        blurb: 'Your own machine running Docker: containers, images and Dockerfiles, config and data, networks, Compose, registries and day-2 operations.',
        challengeIds: [
          'docker-00-first-container-on-the-order-box',
          'docker-01-run-order-processor-in-a-container',
          'docker-02-inspect-and-manage-payment-handler',
          'docker-03-write-a-dockerfile-for-order-processor',
          'docker-04-fast-rebuilds-and-a-clean-image',
          'docker-06-run-order-processor-as-non-root',
          'docker-07-health-check-for-order-processor',
          'docker-08-configure-order-processor-with-env-files',
          'docker-09-keep-the-payment-key-out-of-the-image',
          'docker-10-move-orders-db-to-a-named-volume',
          'docker-11-live-templates-with-bind-mounts-and-tmpfs',
          'docker-12-connect-services-on-a-user-defined-network',
          'docker-13-publish-only-the-ports-you-need',
          'docker-14-compose-the-order-stack',
          'docker-15-start-the-stack-in-the-right-order',
          'docker-16-dev-and-prod-from-one-compose-file',
          'docker-17-push-and-pin-with-a-private-registry',
          'docker-18-roll-back-a-bad-release',
          'docker-19-restart-policies-that-match-the-job',
          'docker-20-memory-and-cpu-limits',
          'docker-21-lock-down-payment-handler',
          'docker-22-keep-container-logs-from-filling-the-disk',
          'docker-23-docker-disk-full-on-the-order-box',
          'docker-24-rescue-a-crashlooping-container',
          'docker-25-order-stack-incident',
        ],
        chapters: [
          {
            id: 'containers-and-images',
            kicker: 'Chapter 1',
            title: 'Containers and Images',
            labs: [
              { challengeId: 'docker-00-first-container-on-the-order-box' },
              { challengeId: 'docker-01-run-order-processor-in-a-container' },
              { challengeId: 'docker-02-inspect-and-manage-payment-handler' },
              { challengeId: 'docker-03-write-a-dockerfile-for-order-processor' },
              { challengeId: 'docker-04-fast-rebuilds-and-a-clean-image' },
              { challengeId: 'docker-06-run-order-processor-as-non-root' },
              { challengeId: 'docker-07-health-check-for-order-processor' },
            ],
          },
          {
            id: 'config-secrets-and-data',
            kicker: 'Chapter 2',
            title: 'Config, Secrets, and Data',
            labs: [
              { challengeId: 'docker-08-configure-order-processor-with-env-files' },
              { challengeId: 'docker-09-keep-the-payment-key-out-of-the-image' },
              { challengeId: 'docker-10-move-orders-db-to-a-named-volume' },
              { challengeId: 'docker-11-live-templates-with-bind-mounts-and-tmpfs' },
            ],
          },
          {
            id: 'networks-and-compose',
            kicker: 'Chapter 3',
            title: 'Networks and Compose',
            labs: [
              { challengeId: 'docker-12-connect-services-on-a-user-defined-network' },
              { challengeId: 'docker-13-publish-only-the-ports-you-need' },
              { challengeId: 'docker-14-compose-the-order-stack' },
              { challengeId: 'docker-15-start-the-stack-in-the-right-order' },
              { challengeId: 'docker-16-dev-and-prod-from-one-compose-file' },
            ],
          },
          {
            id: 'registry-and-day-2',
            kicker: 'Chapter 4',
            title: 'Registry and Day-2',
            labs: [
              { challengeId: 'docker-17-push-and-pin-with-a-private-registry' },
              { challengeId: 'docker-18-roll-back-a-bad-release' },
              { challengeId: 'docker-19-restart-policies-that-match-the-job' },
              { challengeId: 'docker-20-memory-and-cpu-limits' },
              { challengeId: 'docker-21-lock-down-payment-handler' },
              { challengeId: 'docker-22-keep-container-logs-from-filling-the-disk' },
              { challengeId: 'docker-23-docker-disk-full-on-the-order-box' },
              { challengeId: 'docker-24-rescue-a-crashlooping-container' },
            ],
          },
          {
            id: 'capstone',
            kicker: 'Chapter 5',
            title: 'Capstone',
            labs: [{ challengeId: 'docker-25-order-stack-incident' }],
          },
        ],
      },
      {
        id: 'kubernetes',
        label: 'Kubernetes',
        subtitle: 'Workloads on a shared cluster',
        tileBlurb:
          'Put a service on the cluster and give it an address. Feed it config, keep it alive with probes, store its data, and bring it back when a pod will not stay up.',
        blurb: 'CKAD-style labs: deploy, configure, and troubleshoot application workloads on a shared cluster.',
        challengeIds: [
          'k8s-00-meet-kubectl',
          'l1-namespace-and-pod',
          'k8s-02-scale-out-with-a-replicaset',
          'k8s-03-roll-forward-with-a-deployment',
          'k8s-04-stable-address-for-payment-handler',
          'k8s-05-expose-order-processor-for-qa',
          'k8s-06-config-without-rebuilding-images',
          'k8s-07-keep-credentials-in-a-secret',
          'k8s-08-audit-trail-with-a-sidecar',
          'k8s-09-migrate-schema-before-the-app-starts',
          'k8s-10-firewall-rules-between-order-and-payment',
          'k8s-11-cap-order-processor-cpu-and-memory',
          'k8s-12-restart-dead-order-processor-pods',
          'k8s-13-keep-broken-pods-out-of-the-service',
          'k8s-14-give-slow-starters-time-to-boot',
          'k8s-15-lock-down-payment-handler-process',
          'k8s-16-identity-for-settlement-export',
          'k8s-17-run-settlement-export-as-a-job',
          'k8s-19-claim-disk-for-order-processor',
          'k8s-20-stateful-orders-database',
          'k8s-21-discover-each-database-pod-by-name',
          'k8s-22-dynamic-disks-via-storageclass',
          'k8s-23-local-disk-for-hot-payment-writes',
          'k8s-24-snapshot-and-restore-order-archives',
          'k8s-25-pin-payment-handler-to-payment-nodes',
          'k8s-26-prefer-notification-nodes-softly',
          'k8s-27-colocate-notifications-near-orders',
          'k8s-28-spread-payment-replicas-across-nodes',
          'k8s-29-only-payments-on-tainted-pci-nodes',
          'k8s-30-canary-the-notification-service',
          'k8s-31-blue-green-cutover-for-payment-handler',
          'k8s-32-package-notification-service-with-helm',
          'k8s-33-one-chart-staging-and-prod-values',
          'k8s-34-nightly-order-reconciliation-job',
          'k8s-35-encrypt-service-to-service-traffic',
          'k8s-36-one-front-door-for-qa-and-partners',
          'k8s-37-scale-notifications-with-load',
          'k8s-38-right-size-payment-handler-resources',
          'k8s-39-keep-enough-payments-during-node-drains',
          'k8s-40-roll-forward-and-undo-order-processor',
          'k8s-41-rescue-crashlooping-notifications',
          'k8s-42-ship-notification-templates-as-files',
          'k8s-43-drain-order-processor-without-dropping-inflight',
        ],
        chapters: [
          {
            id: 'workloads-and-services',
            kicker: 'Chapter 1',
            title: 'Workloads and Services',
            labs: [
              { challengeId: 'k8s-00-meet-kubectl' },
              { challengeId: 'l1-namespace-and-pod' },
              { challengeId: 'k8s-02-scale-out-with-a-replicaset' },
              { challengeId: 'k8s-03-roll-forward-with-a-deployment' },
              { challengeId: 'k8s-04-stable-address-for-payment-handler' },
              { challengeId: 'k8s-05-expose-order-processor-for-qa' },
            ],
          },
          {
            id: 'config-sidecars-and-policy',
            kicker: 'Chapter 2',
            title: 'Config, Sidecars, and Policy',
            labs: [
              { challengeId: 'k8s-06-config-without-rebuilding-images' },
              { challengeId: 'k8s-07-keep-credentials-in-a-secret' },
              { challengeId: 'k8s-08-audit-trail-with-a-sidecar' },
              { challengeId: 'k8s-09-migrate-schema-before-the-app-starts' },
              { challengeId: 'k8s-10-firewall-rules-between-order-and-payment' },
              { challengeId: 'k8s-11-cap-order-processor-cpu-and-memory' },
            ],
          },
          {
            id: 'probes-hardening-and-batch',
            kicker: 'Chapter 3',
            title: 'Probes, Hardening, and Batch',
            labs: [
              { challengeId: 'k8s-12-restart-dead-order-processor-pods' },
              { challengeId: 'k8s-13-keep-broken-pods-out-of-the-service' },
              { challengeId: 'k8s-14-give-slow-starters-time-to-boot' },
              { challengeId: 'k8s-15-lock-down-payment-handler-process' },
              { challengeId: 'k8s-16-identity-for-settlement-export' },
              { challengeId: 'k8s-17-run-settlement-export-as-a-job' },
            ],
          },
          {
            id: 'storage-and-statefulsets',
            kicker: 'Chapter 4',
            title: 'Storage and StatefulSets',
            labs: [
              { challengeId: 'k8s-19-claim-disk-for-order-processor' },
              { challengeId: 'k8s-20-stateful-orders-database' },
              { challengeId: 'k8s-21-discover-each-database-pod-by-name' },
              { challengeId: 'k8s-22-dynamic-disks-via-storageclass' },
              { challengeId: 'k8s-23-local-disk-for-hot-payment-writes' },
              { challengeId: 'k8s-24-snapshot-and-restore-order-archives' },
            ],
          },
          {
            id: 'scheduling',
            kicker: 'Chapter 5',
            title: 'Scheduling',
            labs: [
              { challengeId: 'k8s-25-pin-payment-handler-to-payment-nodes' },
              { challengeId: 'k8s-26-prefer-notification-nodes-softly' },
              { challengeId: 'k8s-27-colocate-notifications-near-orders' },
              { challengeId: 'k8s-28-spread-payment-replicas-across-nodes' },
              { challengeId: 'k8s-29-only-payments-on-tainted-pci-nodes' },
            ],
          },
          {
            id: 'ship-the-release',
            kicker: 'Chapter 6',
            title: 'Ship the Release',
            labs: [
              { challengeId: 'k8s-30-canary-the-notification-service' },
              { challengeId: 'k8s-31-blue-green-cutover-for-payment-handler' },
              { challengeId: 'k8s-32-package-notification-service-with-helm' },
              { challengeId: 'k8s-33-one-chart-staging-and-prod-values' },
            ],
          },
          {
            id: 'app-ops-and-incidents',
            kicker: 'Chapter 7',
            title: 'App Ops and Incidents',
            labs: [
              { challengeId: 'k8s-34-nightly-order-reconciliation-job' },
              { challengeId: 'k8s-35-encrypt-service-to-service-traffic' },
              { challengeId: 'k8s-36-one-front-door-for-qa-and-partners' },
              { challengeId: 'k8s-37-scale-notifications-with-load' },
              { challengeId: 'k8s-38-right-size-payment-handler-resources' },
              { challengeId: 'k8s-39-keep-enough-payments-during-node-drains' },
              { challengeId: 'k8s-40-roll-forward-and-undo-order-processor' },
              { challengeId: 'k8s-41-rescue-crashlooping-notifications' },
              { challengeId: 'k8s-42-ship-notification-templates-as-files' },
              { challengeId: 'k8s-43-drain-order-processor-without-dropping-inflight' },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'platforms-engineer',
    label: 'Platforms Engineer',
    blurb:
      'The shared systems other engineers run on. Kafka, Spark, and Kubernetes clusters that are already up.',
    panels: [
      {
        id: 'kafka',
        label: 'Kafka',
        subtitle: 'ZooKeeper first, then KRaft',
        tileBlurb:
          'Start on ZooKeeper-era brokers, then move to KRaft. ISR, consumers, and platform guardrails on QuickBite’s Kafka. You run the cluster — not the services.',
        blurb:
          'Lab 1 is the classic ZooKeeper control plane. From Lab 2 the track is KRaft. You run the brokers; you don’t write the producers.',
        challengeIds: [
          'kafka-01-stand-up-the-cluster-and-find-everything-on-disk',
          'kafka-02-open-a-topic-the-platform-way',
          'kafka-03-trace-a-produce-from-client-to-last-replica',
          'kafka-04-the-partition-and-replica-map',
          'kafka-05-under-replicated-is-not-a-failed-write',
          'kafka-06-min-isr-is-why-produces-fail',
          'kafka-07-segments-retention-and-why-disk-fills',
          'kafka-08-capstone-disk-isr-and-the-write-path',
          'kafka-00-first-shift-on-the-kafka-cluster',
          'kafka-01-open-the-notifications-topic',
          'kafka-02-orders-audit-has-one-copy',
          'kafka-03-broker-2-left-the-isr',
          'kafka-04-payments-is-rejecting-writes',
          'kafka-05-disk-full-on-broker-1',
          'kafka-06-orders-was-compacted',
          'kafka-07-one-partition-of-payments-is-behind',
          'kafka-08-put-the-notification-offsets-back',
          'kafka-09-payments-incident',
        ],
        chapters: [
          {
            id: 'foundations',
            kicker: 'Chapter 1',
            title: 'Foundations of a Kafka Cluster',
            labs: [
              { challengeId: 'kafka-01-stand-up-the-cluster-and-find-everything-on-disk', free: true },
              { challengeId: 'kafka-02-open-a-topic-the-platform-way', free: true },
              { challengeId: 'kafka-03-trace-a-produce-from-client-to-last-replica' },
              { challengeId: 'kafka-04-the-partition-and-replica-map' },
              { challengeId: 'kafka-05-under-replicated-is-not-a-failed-write' },
              { challengeId: 'kafka-06-min-isr-is-why-produces-fail' },
              { challengeId: 'kafka-07-segments-retention-and-why-disk-fills' },
              { challengeId: 'kafka-08-capstone-disk-isr-and-the-write-path' },
            ],
          },
          {
            id: 'consumers',
            kicker: 'Chapter 2',
            title: 'Consumer Groups and Read Position',
            labs: [
              { title: 'Meet the Consumer Group', placeholder: true },
              { title: 'One Partition Stuck the Desk', placeholder: true },
              { title: 'Put the Offsets Back', placeholder: true },
              { title: 'The Group Never Stays Stable', placeholder: true },
              { title: 'Replay Ate the Request Path', placeholder: true },
            ],
          },
          {
            id: 'kubernetes',
            kicker: 'Chapter 3',
            title: 'Kafka on Kubernetes',
            labs: [
              { title: 'Broker Identity Is the PVC', placeholder: true },
              { title: 'Clients Are Calling an Address Brokers Do Not Advertise', placeholder: true },
              { title: 'Roll One Broker at a Time', placeholder: true },
              { title: 'StorageClass and the Broker That Never Joins', placeholder: true },
              { title: 'Bootstrap, Namespace, and Listener Drift', placeholder: true },
            ],
          },
          {
            id: 'platform-automations',
            kicker: 'Chapter 4',
            title: 'Platform Automations',
            labs: [
              { title: 'Topic Shape as Desired State', placeholder: true },
              { title: 'ACL and Quota From the Request File', placeholder: true },
              { title: 'Refuse RF=1 and Keep-Forever', placeholder: true },
              { title: 'Print Drift, Then Repair', placeholder: true },
              { title: 'Topic Request API', placeholder: true },
            ],
          },
          {
            id: 'capacity',
            kicker: 'Chapter 5',
            title: 'Capacity, Leadership, and Placement',
            labs: [
              { title: 'Under-Replicated Report', placeholder: true },
              { title: 'Lag Report for Dispatch', placeholder: true },
              { title: 'One Key Owns the Topic', placeholder: true },
              { title: 'Move Replicas Onto the Empty Broker', placeholder: true },
              { title: 'Shed Leadership Before the Patch', placeholder: true },
            ],
          },
          {
            id: 'incidents',
            kicker: 'Chapter 6',
            title: 'Incidents',
            labs: [
              { title: 'Leader Disk Full, Desk Behind', placeholder: true },
              { title: 'Offsets After the Firefight', placeholder: true },
              { title: 'Two Topics, One Full Broker', placeholder: true },
              { title: 'Drain While the Cluster Is Already Hurting', placeholder: true },
              { title: 'Quota, Listener, and Disk Together', placeholder: true },
            ],
          },
          {
            id: 'backlog',
            kicker: 'Backlog',
            title: 'Backlog pool',
            labs: [
              { challengeId: 'kafka-00-first-shift-on-the-kafka-cluster' },
              { challengeId: 'kafka-01-open-the-notifications-topic' },
              { challengeId: 'kafka-02-orders-audit-has-one-copy' },
              { challengeId: 'kafka-03-broker-2-left-the-isr' },
              { challengeId: 'kafka-04-payments-is-rejecting-writes' },
              { challengeId: 'kafka-05-disk-full-on-broker-1' },
              { challengeId: 'kafka-06-orders-was-compacted' },
              { challengeId: 'kafka-07-one-partition-of-payments-is-behind' },
              { challengeId: 'kafka-08-put-the-notification-offsets-back' },
              { challengeId: 'kafka-09-payments-incident' },
            ],
          },
        ],
      },
      {
        id: 'spark',
        label: 'Spark',
        subtitle: 'A cluster that is already up',
        tileBlurb:
          'Master, workers, and live applications on QuickBite’s Spark. You run the cluster. You don’t write the jobs.',
        blurb:
          'Master, workers, and live applications on QuickBite’s Spark. The cluster is already up. You run the workers.',
        challengeIds: [
          'spark-01-stand-up-the-cluster-and-find-everything-on-disk',
          'spark-02-read-the-master-ui-and-a-worker-ui-as-instruments',
          'spark-03-trace-a-job-from-submission-to-last-task',
          'spark-04-find-where-the-data-actually-lives',
          'spark-05-the-executor-memory-map',
          'spark-06-diagnose-an-executor-lost-to-memory-pressure',
          'spark-07-the-capstone-bug-slow-then-dead',
          'spark-08-post-maintenance-mess',
          'spark-14-dns-memory-and-disk-triple',
          'spark-09-submit-the-same-workload-on-yarn',
          'spark-10-read-the-rm-and-nm-as-instruments',
          'spark-11-land-in-the-right-capacity-queue',
          'spark-12-client-mode-driver-is-on-the-wrong-host',
          'spark-13-someone-elses-job-changed-yesterday',
          'spark-15-driver-and-executor-pods-on-kubernetes',
          'spark-16-namespace-quota-blocks-the-submit',
          'spark-17-wrong-image-missing-dependency',
          'spark-18-dynamic-allocation-without-the-shuffle-service',
          'spark-19-driver-oomkilled-spark-memory-vs-k8s-limits',
          'spark-20-multi-fault-k8s-submit',
        ],
        chapters: [
          {
            id: 'foundations',
            kicker: 'Chapter 1',
            title: 'Foundations of a Spark Cluster',
            readingSlug: 'what-is-spark',
            labs: [
              { challengeId: 'spark-01-stand-up-the-cluster-and-find-everything-on-disk', free: true },
              { challengeId: 'spark-02-read-the-master-ui-and-a-worker-ui-as-instruments', free: true },
              { challengeId: 'spark-03-trace-a-job-from-submission-to-last-task' },
              { challengeId: 'spark-04-find-where-the-data-actually-lives' },
              { challengeId: 'spark-05-the-executor-memory-map' },
              { challengeId: 'spark-06-diagnose-an-executor-lost-to-memory-pressure' },
              { challengeId: 'spark-07-the-capstone-bug-slow-then-dead' },
              { challengeId: 'spark-08-post-maintenance-mess' },
            ],
          },
          {
            id: 'yarn',
            kicker: 'Chapter 2',
            title: 'Spark on YARN',
            readingSlug: 'spark-on-yarn',
            labs: [
              { challengeId: 'spark-09-submit-the-same-workload-on-yarn' },
              { challengeId: 'spark-10-read-the-rm-and-nm-as-instruments' },
              { challengeId: 'spark-11-land-in-the-right-capacity-queue' },
              { challengeId: 'spark-12-client-mode-driver-is-on-the-wrong-host' },
              { challengeId: 'spark-13-someone-elses-job-changed-yesterday' },
            ],
          },
          {
            id: 'kubernetes',
            kicker: 'Chapter 3',
            title: 'Spark on Kubernetes',
            readingSlug: 'spark-on-kubernetes',
            labs: [
              { challengeId: 'spark-15-driver-and-executor-pods-on-kubernetes' },
              { challengeId: 'spark-16-namespace-quota-blocks-the-submit' },
              { challengeId: 'spark-17-wrong-image-missing-dependency' },
              { challengeId: 'spark-18-dynamic-allocation-without-the-shuffle-service' },
              { challengeId: 'spark-19-driver-oomkilled-spark-memory-vs-k8s-limits' },
              { challengeId: 'spark-20-multi-fault-k8s-submit' },
            ],
          },
          {
            id: 'platform-automations',
            kicker: 'Chapter 4',
            title: 'Platform Automations',
            readingSlug: 'platform-automations',
            labs: [
              { title: 'Infra-as-Code for the Cluster Shape', placeholder: true },
              { title: 'Automated Environment and Dependency Provision', placeholder: true },
              { title: 'Guardrail: Refuse the Bad Request', placeholder: true },
              { title: 'Detect Drift, Then Reconcile', placeholder: true },
              { title: 'Self-Service Job Request API', placeholder: true },
              { title: 'Auto-Tuner: Right-Size From the Physical Plan', placeholder: true },
              { title: 'Submit Through Livy Instead of SSH', placeholder: true },
            ],
          },
          {
            id: 'observability',
            kicker: 'Chapter 5',
            title: 'Observability and Optimizations',
            readingSlug: 'observability-and-optimizations',
            labs: [
              { title: 'History Server Reads the Right Event Logs', placeholder: true },
              { title: 'Stage Time Is One Hot Task', placeholder: true },
              { title: 'Spill and GC Before You Add Executors', placeholder: true },
              { title: 'Lag Report as a Tool', placeholder: true },
              { title: 'Shuffle Service Health on the Critical Path', placeholder: true },
            ],
          },
          {
            id: 'incidents',
            kicker: 'Chapter 6',
            title: 'Incidents',
            readingSlug: 'incidents',
            labs: [
              { title: 'Disk Full and a Stuck Query at Once', placeholder: true },
              { title: 'Checkpoint Restored Wrong After the Firefight', placeholder: true },
              { title: 'Executors Lost Under Shared-Worker Pressure', placeholder: true },
              { title: 'Drain During an Incident Without Making It Worse', placeholder: true },
              { title: 'Cascading Failure Across Queue and Namespace', placeholder: true },
            ],
          },
          {
            id: 'backlog',
            kicker: 'Backlog',
            title: 'Backlog pool',
            labs: [
              { challengeId: 'spark-14-dns-memory-and-disk-triple' },
            ],
          },
        ],
      },
      {
        id: 'kubernetes',
        label: 'Kubernetes',
        subtitle: 'A cluster that is already up',
        tileBlurb:
          'Nodes, scheduling, and the control plane on QuickBite’s Kubernetes. You run the cluster. You don’t share it.',
        blurb:
          'Nodes, scheduling, and the control plane on QuickBite’s Kubernetes. The cluster is already up. You are the admin of that lab only.',
        // Packs not shipped yet — chapter shelf is the CKA curriculum shell.
        challengeIds: [],
        chapters: [
          {
            id: 'cluster-architecture',
            kicker: 'Chapter 1',
            title: 'Cluster Architecture, Installation & Configuration',
            labs: [
              { title: 'Bind the Settlement Team to Their Namespace', placeholder: true },
              { title: 'Prepare a Machine for kubeadm', placeholder: true },
              { title: 'Bootstrap a Cluster with kubeadm', placeholder: true },
              { title: 'Upgrade the Cluster Without Dropping Workloads', placeholder: true },
              { title: 'Three Control Planes and a Failed Node', placeholder: true },
              { title: 'Install Components with Helm and Kustomize', placeholder: true },
              { title: 'CNI, CSI, CRI: The Extension Interfaces', placeholder: true },
              { title: 'Install an Operator and Manage Custom Resources', placeholder: true },
            ],
          },
          {
            id: 'workloads-and-scheduling',
            kicker: 'Chapter 2',
            title: 'Workloads & Scheduling',
            labs: [
              { title: 'Roll Forward, Then Roll Back', placeholder: true },
              { title: 'Config from ConfigMaps, Credentials from Secrets', placeholder: true },
              { title: 'Autoscale Notifications Under Load', placeholder: true },
              { title: 'Self-Healing: Replicas, Probes, and Recovery', placeholder: true },
              { title: 'Admission, Limits, Affinity, and Taints', placeholder: true },
            ],
          },
          {
            id: 'services-and-networking',
            kicker: 'Chapter 3',
            title: 'Services & Networking',
            labs: [
              { title: 'Pod-to-Pod: The Flat Network', placeholder: true },
              { title: 'NetworkPolicy: Only Orders Can Call Payments', placeholder: true },
              { title: 'ClusterIP, NodePort, LoadBalancer, and Endpoints', placeholder: true },
              { title: 'Gateway API: The Modern Ingress', placeholder: true },
              { title: 'Ingress Controller and Ingress Resources', placeholder: true },
              { title: "CoreDNS: When Service Names Don't Resolve", placeholder: true },
            ],
          },
          {
            id: 'storage',
            kicker: 'Chapter 4',
            title: 'Storage',
            labs: [
              { title: 'Dynamic Provisioning with StorageClass', placeholder: true },
              { title: 'Access Modes and Reclaim Policies', placeholder: true },
              { title: 'Static Provisioning: Create the PV First', placeholder: true },
            ],
          },
          {
            id: 'troubleshooting',
            kicker: 'Chapter 5',
            title: 'Troubleshooting',
            labs: [
              { title: "A Node Won't Join: Fix NotReady", placeholder: true },
              { title: 'The Scheduler Is Down: Nothing New Runs', placeholder: true },
              { title: 'OOMKilled: Reading Resource Usage', placeholder: true },
              { title: 'Read the Logs: Crashloop Diagnosis', placeholder: true },
              { title: 'Service Has No Endpoints', placeholder: true },
            ],
          },
          {
            id: 'platform-automations',
            kicker: 'Chapter 6',
            title: 'Platform Automations',
            labs: [
              { title: 'Apply the Namespace from the Request File', placeholder: true },
              { title: 'Refuse the Bad Request', placeholder: true },
              { title: 'Ship a Node Health Report', placeholder: true },
              { title: 'Ship a Pending Pod Report', placeholder: true },
              { title: 'RBAC from the Team Template', placeholder: true },
              { title: 'Quota the Runaway Namespace', placeholder: true },
              { title: 'Detect Drift Without Fixing It', placeholder: true },
              { title: 'Reconcile to Desired State', placeholder: true },
              { title: 'Drain Helper: Safe Node Evacuation', placeholder: true },
              { title: 'Namespace Request API', placeholder: true },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'data-engineer',
    label: 'Data Engineer',
    blurb: 'Batch pipelines, warehouses, and orchestration.',
    panels: [
      {
        id: 'spark',
        label: 'Spark',
        subtitle: 'You write the job',
        tileBlurb:
          'Clean overnight drops, rollups, joins, and settlement on a shared Spark platform. You author the transform — the cluster is already up.',
        blurb:
          'Distributed batch processing on a shared Spark platform. You write the job; you do not run the workers.',
        challengeIds: [
          'l1-filter-valid-sales-rows',
          'l1-derive-revenue-column',
          'l1-sample-qa-slice',
          'l1-distinct-store-list',
          'l1-store-contribution-hours',
          'l1-store-rollup-totals',
          'l1-store-payment-profile',
          'l1-store-customer-segments',
          'l1-enrich-auth-mcc',
          'l2-store-that-ate-the-shuffle',
          'l2-split-the-hot-aisle',
          'l2-every-cashier-tiny-desk',
          'l2-two-hundred-tasks-quiet-night',
          'l2-directory-small-until-it-wasnt',
          'l3-interchange-fee-settlement',
          'l3-click-attribution-stream-join',
        ],
        chapters: [
          {
            id: 'dataframe-foundations',
            kicker: 'Chapter 1',
            title: 'DataFrame Foundations',
            labs: [
              { challengeId: 'l1-filter-valid-sales-rows' },
              { challengeId: 'l1-derive-revenue-column' },
              { challengeId: 'l1-sample-qa-slice' },
              { title: 'Rename and Select the Contract', placeholder: true },
              { title: 'Handle Missing and Malformed Data', placeholder: true },
              { title: 'Union Daily Drops Into One Frame', placeholder: true },
            ],
          },
          {
            id: 'aggregations-and-windowing',
            kicker: 'Chapter 2',
            title: 'Aggregations and Windowing',
            labs: [
              { challengeId: 'l1-distinct-store-list' },
              { challengeId: 'l1-store-contribution-hours' },
              { challengeId: 'l1-store-rollup-totals' },
              { challengeId: 'l1-store-payment-profile' },
              { challengeId: 'l1-store-customer-segments' },
              { title: 'Rank Stores by Revenue', placeholder: true },
              { title: 'Running Total Per Store', placeholder: true },
            ],
          },
          {
            id: 'joins-and-enrichment',
            kicker: 'Chapter 3',
            title: 'Joins and Enrichment',
            labs: [
              { challengeId: 'l1-enrich-auth-mcc' },
              { title: 'Left Join Orders to Nullable Dimension', placeholder: true },
              { title: 'Anti-Join: Find Orphan Transactions', placeholder: true },
              { title: 'Self-Join for Duplicate Detection', placeholder: true },
              { title: 'Multi-Way Join Pipeline', placeholder: true },
            ],
          },
          {
            id: 'performance-optimization',
            kicker: 'Chapter 4',
            title: 'Performance Optimization',
            labs: [
              { challengeId: 'l2-store-that-ate-the-shuffle' },
              { challengeId: 'l2-split-the-hot-aisle' },
              { challengeId: 'l2-every-cashier-tiny-desk' },
              { challengeId: 'l2-two-hundred-tasks-quiet-night' },
              { challengeId: 'l2-directory-small-until-it-wasnt' },
            ],
          },
          {
            id: 'adaptive-query-execution',
            kicker: 'Chapter 5',
            title: 'Adaptive Query Execution',
            labs: [
              {
                title: 'Same Skewed Join, AQE On',
                placeholder: true,
              },
              {
                title: 'When AQE Coalesce Makes It Worse',
                placeholder: true,
              },
              {
                title: 'Compare Plan With and Without AQE',
                placeholder: true,
              },
            ],
          },
          {
            id: 'partitioning-and-layout',
            kicker: 'Chapter 6',
            title: 'Partitioning and File Layout',
            labs: [
              { title: 'Partition By Date for Pruning', placeholder: true },
              { title: 'Too Many Small Files', placeholder: true },
              { title: 'Too Few Large Files', placeholder: true },
              { title: 'Bucket Join: Zero Shuffle', placeholder: true },
            ],
          },
          {
            id: 'batch-and-streaming-pipelines',
            kicker: 'Chapter 7',
            title: 'Batch and Streaming Pipelines',
            labs: [
              { challengeId: 'l3-interchange-fee-settlement' },
              { challengeId: 'l3-click-attribution-stream-join' },
              { title: 'Incremental Load with Watermarks', placeholder: true },
              { title: 'Idempotent Partition Overwrite', placeholder: true },
              { title: 'Stream-Static Enrichment', placeholder: true },
              { title: 'Watermark for Late Data', placeholder: true },
            ],
          },
        ],
      },
      {
        id: 'airflow',
        label: 'Airflow',
        subtitle: 'You author the DAG',
        tileBlurb:
          'Dependencies, schedules, retries, and sensors on QuickBite’s Airflow. You write the DAG — the scheduler is already running.',
        blurb:
          'DAG orchestration and dependency-aware scheduling. You author the pipeline; you do not install the cluster.',
        challengeIds: [],
        chapters: [
          {
            id: 'dag-fundamentals',
            kicker: 'Chapter 1',
            title: 'DAG Fundamentals',
            labs: [
              { title: 'Hello World DAG', placeholder: true },
              { title: 'Read the DAG in the UI', placeholder: true },
              { title: 'Sequential and Parallel Tasks', placeholder: true },
              { title: 'A Task That Fails and Retries', placeholder: true },
              { title: 'Conditional Branching', placeholder: true },
              { title: 'Operators: Bash, Python, SQL', placeholder: true },
              { title: 'Sensors: Wait for Conditions', placeholder: true },
            ],
          },
          {
            id: 'data-flow-and-configuration',
            kicker: 'Chapter 2',
            title: 'Data Flow and Configuration',
            labs: [
              { title: 'Return Value Becomes XCom', placeholder: true },
              { title: 'XCom Size Limits', placeholder: true },
              { title: 'Dynamic Task Mapping', placeholder: true },
              { title: 'Jinja Templating', placeholder: true },
              { title: 'Variables and Connections', placeholder: true },
              { title: 'Params for Runtime Variation', placeholder: true },
            ],
          },
          {
            id: 'scheduling-and-time',
            kicker: 'Chapter 3',
            title: 'Scheduling and Time',
            labs: [
              { title: 'Cron Schedule Expressions', placeholder: true },
              { title: 'The Execution Date Trap', placeholder: true },
              { title: 'Data Interval Start and End', placeholder: true },
              { title: 'Catchup: Backfill or Skip', placeholder: true },
              { title: 'Dataset-Triggered DAGs', placeholder: true },
              { title: 'Cross-DAG Dependencies', placeholder: true },
            ],
          },
          {
            id: 'failure-handling-and-testing',
            kicker: 'Chapter 4',
            title: 'Failure Handling and Testing',
            labs: [
              { title: 'Retry Strategy', placeholder: true },
              { title: 'Callbacks: on_failure, on_success', placeholder: true },
              { title: 'SLA Misses and Alerting', placeholder: true },
              { title: 'DAG Import and Structure Tests', placeholder: true },
              { title: 'Unit Test Python Callables', placeholder: true },
              { title: 'Integration Test with dag.test()', placeholder: true },
            ],
          },
          {
            id: 'performance-and-debugging',
            kicker: 'Chapter 5',
            title: 'Performance and Debugging',
            labs: [
              { title: 'DAG Not Appearing in UI', placeholder: true },
              { title: 'Task Stuck in Queued', placeholder: true },
              { title: 'Task Stuck in Running (Zombie)', placeholder: true },
              { title: 'Sensor Timeout', placeholder: true },
              { title: 'DAG Parse Time Is Killing the Scheduler', placeholder: true },
              { title: 'Pools and Priority', placeholder: true },
              { title: 'Database Deadlocks', placeholder: true },
            ],
          },
          {
            id: 'production-patterns',
            kicker: 'Chapter 6',
            title: 'Production Patterns',
            labs: [
              { title: 'Incremental Load with High Watermark', placeholder: true },
              { title: 'Idempotent Pipeline', placeholder: true },
              { title: 'Data Quality Checks as Tasks', placeholder: true },
              { title: 'Dynamic DAGs from Config', placeholder: true },
              { title: 'The Danger of Top-Level Queries', placeholder: true },
              { title: 'Orchestrate External Jobs', placeholder: true },
              { title: 'Observability: Metrics and Logging', placeholder: true },
            ],
          },
          {
            id: 'capstones',
            kicker: 'Chapter 7',
            title: 'Capstones',
            labs: [
              { title: 'The Nightly ETL That Stopped', placeholder: true },
              { title: 'Build the Invoicing Pipeline', placeholder: true },
              { title: 'The DAG That Took Down the Scheduler', placeholder: true },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'software-engineer',
    label: 'Software Engineer',
    blurb: 'Build backend services — git, databases, APIs, async workers, caching, and auth.',
    panels: [
      {
        id: 'git',
        label: 'Git',
        subtitle: 'A planted repo on your machine',
        tileBlurb:
          'sprint-service on Forgeboard — dirty trees, bad merges, lost commits. Fix the history. Submit checks the repo.',
        blurb:
          'Git on a Linux dev box. Clone from git.forgeboard.internal over SSH, then commit, push, branch, merge, rebase, and recover. No forge UI required.',
        challengeIds: [
          'git-01-first-commit-on-sprint-service',
          'git-02-branch-for-the-flag-fix',
          'git-03-untrack-the-leaked-env',
          'git-04-amend-the-last-commit',
          'git-05-merge-without-conflict',
          'git-07-rebase-onto-main',
          'git-08-interactive-rebase-squash-the-noise',
          'git-09-cherry-pick-the-hotfix',
          'git-10-undo-the-bad-commit',
          'git-11-reset-and-reflog-recover-lost-work',
          'git-12-bisect-find-the-breaking-commit',
          'git-13-blame-who-changed-this-line',
          'git-21-restore-deleted-notify-helper',
          'git-14-stash-work-in-progress',
          'git-16-sync-shared-feature-after-rejected-push',
          'git-17-worktree-the-parallel-hotfix',
          'git-15-capstone-untangle-the-merge-mess',
          'git-18-tag-release-and-cut-patch-branch',
          'git-19-sync-fork-with-upstream',
          'git-20-block-bad-commits-with-a-hook',
          'git-22-scrub-secret-from-unpushed-branch',
        ],
        chapters: [
          {
            id: 'commits-and-branches',
            kicker: 'Chapter 1',
            title: 'Commits and Branches',
            readingSlug: 'why-git',
            labs: [
              { challengeId: 'git-01-first-commit-on-sprint-service', free: true },
              { challengeId: 'git-02-branch-for-the-flag-fix', free: true },
              { challengeId: 'git-03-untrack-the-leaked-env' },
              { challengeId: 'git-04-amend-the-last-commit' },
            ],
          },
          {
            id: 'merging-and-rebasing',
            kicker: 'Chapter 2',
            title: 'Merging and Rebasing',
            readingSlug: 'merging',
            labs: [
              { challengeId: 'git-05-merge-without-conflict' },
              { challengeId: 'git-07-rebase-onto-main' },
              { challengeId: 'git-08-interactive-rebase-squash-the-noise' },
              { challengeId: 'git-09-cherry-pick-the-hotfix' },
            ],
          },
          {
            id: 'history-and-recovery',
            kicker: 'Chapter 3',
            title: 'History and Recovery',
            readingSlug: 'undo-and-recover',
            labs: [
              { challengeId: 'git-10-undo-the-bad-commit' },
              { challengeId: 'git-11-reset-and-reflog-recover-lost-work' },
              { challengeId: 'git-12-bisect-find-the-breaking-commit' },
              { challengeId: 'git-13-blame-who-changed-this-line' },
              { challengeId: 'git-21-restore-deleted-notify-helper' },
            ],
          },
          {
            id: 'collaboration',
            kicker: 'Chapter 4',
            title: 'Collaboration',
            readingSlug: 'bisect-blame-stash',
            labs: [
              { challengeId: 'git-14-stash-work-in-progress' },
              { challengeId: 'git-16-sync-shared-feature-after-rejected-push' },
              { challengeId: 'git-17-worktree-the-parallel-hotfix' },
              { challengeId: 'git-15-capstone-untangle-the-merge-mess' },
            ],
          },
          {
            id: 'releases-hooks-remotes',
            kicker: 'Chapter 5',
            title: 'Releases, Hooks & Remotes',
            readingSlug: 'tags-remotes-hooks',
            labs: [
              { challengeId: 'git-18-tag-release-and-cut-patch-branch' },
              { challengeId: 'git-19-sync-fork-with-upstream' },
              { challengeId: 'git-20-block-bad-commits-with-a-hook' },
              { challengeId: 'git-22-scrub-secret-from-unpushed-branch' },
            ],
          },
        ],
      },
      {
        id: 'databases',
        label: 'Databases',
        subtitle: 'Query QuickBite’s data',
        tileBlurb:
          'Postgres on your box with orders, customers, and payments already loaded. Write the SQL, fix the plan, migrate the schema.',
        blurb:
          'Local Postgres with a QuickBite schema. You write queries under ~/answers/; Submit runs them and checks the result set.',
        challengeIds: [
          'db-01-your-first-select',
          'db-02-where-with-multiple-conditions',
          'db-03-join-orders-to-customers',
          'db-04-left-join-find-orphan-records',
          'db-05-aggregations-daily-revenue',
          'db-06-group-by-and-having',
          'db-07-subquery-orders-above-average',
          'db-08-window-functions-running-total',
          'db-09-cte-readable-complex-query',
          'db-10-insert-update-delete-safely',
          'db-11-transactions-transfer-money',
          'db-12-add-an-index-speed-up-search',
          'db-13-explain-read-the-query-plan',
          'db-14-n-plus-one-one-query-instead-of-fifty',
          'db-15-schema-migration-add-a-column',
          'db-16-document-store-order-as-json',
          'db-17-when-sql-when-nosql',
          'db-18-capstone-settlement-report',
        ],
        chapters: [
          {
            id: 'sql-fundamentals',
            kicker: 'Chapter 1',
            title: 'SQL Fundamentals',
            labs: [
              { challengeId: 'db-01-your-first-select', free: true },
              { challengeId: 'db-02-where-with-multiple-conditions', free: true },
              { challengeId: 'db-03-join-orders-to-customers' },
              { challengeId: 'db-04-left-join-find-orphan-records' },
              { challengeId: 'db-05-aggregations-daily-revenue' },
            ],
          },
          {
            id: 'intermediate-sql',
            kicker: 'Chapter 2',
            title: 'Intermediate SQL',
            labs: [
              { challengeId: 'db-06-group-by-and-having' },
              { challengeId: 'db-07-subquery-orders-above-average' },
              { challengeId: 'db-08-window-functions-running-total' },
              { challengeId: 'db-09-cte-readable-complex-query' },
              { challengeId: 'db-10-insert-update-delete-safely' },
            ],
          },
          {
            id: 'transactions-and-performance',
            kicker: 'Chapter 3',
            title: 'Transactions and Performance',
            labs: [
              { challengeId: 'db-11-transactions-transfer-money' },
              { challengeId: 'db-12-add-an-index-speed-up-search' },
              { challengeId: 'db-13-explain-read-the-query-plan' },
              { challengeId: 'db-14-n-plus-one-one-query-instead-of-fifty' },
              { challengeId: 'db-15-schema-migration-add-a-column' },
            ],
          },
          {
            id: 'documents-and-capstone',
            kicker: 'Chapter 4',
            title: 'Documents and Capstone',
            labs: [
              { challengeId: 'db-16-document-store-order-as-json' },
              { challengeId: 'db-17-when-sql-when-nosql' },
              { challengeId: 'db-18-capstone-settlement-report' },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'distributed-systems-engineer',
    label: 'Distributed Systems Engineer',
    blurb:
      'Build systems that stay correct when machines fail. Simulate clocks, networks, and disks; replay every bug from a seed.',
    // Subtracks: Foundations → Simulation → protocol families. Not Platforms RCA.
    // Design: backend/challenges/distributed-systems/TRACK.md
    // Coding workspace for Foundations: /minors/ds-foundations
    panels: [
      {
        id: 'foundations',
        label: 'Foundations',
        subtitle: 'Why distributed systems break',
        tileBlurb:
          'Fallacies through safety/liveness inside Fleetline (ridernet). All 24 labs open as hybrid project labs: Labs brief + Projects editor.',
        blurb:
          'Conceptual spine for Distributed Systems on a simulated network. Uber-inspired Fleetline world; hybrid project labs (Description / Solution / Submissions + editor).',
        challengeIds: [
          'ds-foundations-01-unreliable-slow-network',
          'ds-foundations-02-constrained-network',
          'ds-foundations-03-changing-untrusted-network',
          'ds-foundations-04-heterogeneous-cluster',
          'ds-foundations-05-silent-failures',
          'ds-foundations-06-wrong-answer-failures',
          'ds-foundations-07-gray-failures',
          'ds-foundations-08-failure-detector',
          'ds-foundations-09-clocks-that-lie',
          'ds-foundations-10-lamport-clocks',
          'ds-foundations-11-vector-clocks',
          'ds-foundations-12-order-the-log',
          'ds-foundations-13-linearizability',
          'ds-foundations-14-weaker-models',
          'ds-foundations-15-eventual-sessions',
          'ds-foundations-16-pick-the-model',
          'ds-foundations-17-partitions-cp',
          'ds-foundations-18-ap-reconcile',
          'ds-foundations-19-pacelc',
          'ds-foundations-20-design-under-cap',
          'ds-foundations-21-safety-properties',
          'ds-foundations-22-liveness-properties',
          'ds-foundations-23-flp-intuition',
          'ds-foundations-24-classify',
        ],
        chapters: [
          {
            id: 'fallacies',
            kicker: 'Chapter 1',
            title: 'The Eight Fallacies',
            labs: [
              { challengeId: 'ds-foundations-01-unreliable-slow-network', free: true },
              { challengeId: 'ds-foundations-02-constrained-network', free: true },
              { challengeId: 'ds-foundations-03-changing-untrusted-network', free: true },
              { challengeId: 'ds-foundations-04-heterogeneous-cluster', free: true },
            ],
          },
          {
            id: 'partial-failure',
            kicker: 'Chapter 2',
            title: 'Partial Failure',
            labs: [
              { challengeId: 'ds-foundations-05-silent-failures', free: true },
              { challengeId: 'ds-foundations-06-wrong-answer-failures', free: true },
              { challengeId: 'ds-foundations-07-gray-failures', free: true },
              { challengeId: 'ds-foundations-08-failure-detector', free: true },
            ],
          },
          {
            id: 'time-ordering',
            kicker: 'Chapter 3',
            title: 'Time and Ordering',
            labs: [
              { challengeId: 'ds-foundations-09-clocks-that-lie', free: true },
              { challengeId: 'ds-foundations-10-lamport-clocks', free: true },
              { challengeId: 'ds-foundations-11-vector-clocks', free: true },
              { challengeId: 'ds-foundations-12-order-the-log', free: true },
            ],
          },
          {
            id: 'consistency',
            kicker: 'Chapter 4',
            title: 'Consistency Models',
            labs: [
              { challengeId: 'ds-foundations-13-linearizability', free: true },
              { challengeId: 'ds-foundations-14-weaker-models', free: true },
              { challengeId: 'ds-foundations-15-eventual-sessions', free: true },
              { challengeId: 'ds-foundations-16-pick-the-model', free: true },
            ],
          },
          {
            id: 'cap',
            kicker: 'Chapter 5',
            title: 'CAP and PACELC',
            labs: [
              { challengeId: 'ds-foundations-17-partitions-cp', free: true },
              { challengeId: 'ds-foundations-18-ap-reconcile', free: true },
              { challengeId: 'ds-foundations-19-pacelc', free: true },
              { challengeId: 'ds-foundations-20-design-under-cap', free: true },
            ],
          },
          {
            id: 'safety-liveness',
            kicker: 'Chapter 6',
            title: 'Safety vs Liveness',
            labs: [
              { challengeId: 'ds-foundations-21-safety-properties', free: true },
              { challengeId: 'ds-foundations-22-liveness-properties', free: true },
              { challengeId: 'ds-foundations-23-flp-intuition', free: true },
              { challengeId: 'ds-foundations-24-classify', free: true },
            ],
          },
        ],
      },
      {
        id: 'simulation',
        label: 'Simulation',
        subtitle: 'The substrate, not a protocol',
        tileBlurb:
          'Replace the clock, network, and disk with tick-driven fakes. Seed faults, check client history, replay every bug. Every protocol panel runs on this.',
        blurb:
          'Deterministic simulation testing: single-threaded execution, simulated network and storage, seeded faults, and client-history checkers. Required before Quorum / Consensus / Transactions.',
        challengeIds: [],
        chapters: [
          {
            id: 'why-simulation',
            kicker: 'Chapter 1',
            title: 'Why Live Testing Lies',
            labs: [
              { title: 'Chaos Finds Availability, Not Correctness', placeholder: true },
              { title: 'The Same Fault, Two Different Traces', placeholder: true },
              { title: 'Four Sources of Nondeterminism', placeholder: true },
              { title: 'Gray Failures: Pause, Delay, and Partial Sync', placeholder: true },
            ],
          },
          {
            id: 'tick-the-world',
            kicker: 'Chapter 2',
            title: 'Tick the World',
            labs: [
              { title: 'One Thread, One Tickable Interface', placeholder: true },
              { title: 'Timeouts Count Ticks, Not Wall Clocks', placeholder: true },
              { title: 'Drive the Cluster Until a Predicate Holds', placeholder: true },
              { title: 'No Sleep, No Blocking Futures', placeholder: true },
            ],
          },
          {
            id: 'simulated-network',
            kicker: 'Chapter 3',
            title: 'Simulated Network',
            labs: [
              { title: 'Messages Queue Until Delivery Tick', placeholder: true },
              { title: 'Drop, Delay, Duplicate, and Reorder', placeholder: true },
              { title: 'Partition a Directed Link', placeholder: true },
              { title: 'Isolate a Node Mid-Request', placeholder: true },
            ],
          },
          {
            id: 'seeded-faults',
            kicker: 'Chapter 4',
            title: 'Seeded Faults and Replay',
            labs: [
              { title: 'One Seed, One Fault Schedule', placeholder: true },
              { title: 'Log Every Fault at Its Tick', placeholder: true },
              { title: 'Fast-Forward Hours of Cluster Time', placeholder: true },
              { title: 'Replay Seed 42 After the Fix', placeholder: true },
            ],
          },
          {
            id: 'correctness',
            kicker: 'Chapter 5',
            title: 'Client History and Correctness',
            labs: [
              { title: 'Record Invoke / Ok / Fail / Timeout', placeholder: true },
              { title: 'Check a Register for Linearizability', placeholder: true },
              { title: 'Hand a Violating History to the Checker', placeholder: true },
              { title: 'The Seed That Broke the Guarantee', placeholder: true },
            ],
          },
          {
            id: 'simulated-disk',
            kicker: 'Chapter 6',
            title: 'Simulated Disk',
            labs: [
              { title: 'Visible Bytes vs Durable Bytes', placeholder: true },
              { title: 'Crash Before sync Loses the Write', placeholder: true },
              { title: 'fsync Failure Mid-WAL', placeholder: true },
              { title: 'Restart and Recover From Durable Only', placeholder: true },
            ],
          },
        ],
      },
      {
        id: 'quorum',
        label: 'Quorum',
        subtitle: 'Majority without a log',
        tileBlurb:
          'Three replicas, two of three to commit — Unmesh’s running example. Then primary–backup and fencing when majority is more than you need.',
        blurb:
          'First protocol family on the harness: quorum KV (coordinators, majority ack, stale reads), then primary–backup with fencing. Graded on linearizable client history under seeded faults.',
        challengeIds: [],
        chapters: [
          {
            id: 'replicas',
            kicker: 'Chapter 1',
            title: 'Replicas and Coordinators',
            labs: [
              { title: 'Three Processes on One Simulated Network', placeholder: true },
              { title: 'Stamp a Write and Fan Out Internal Sets', placeholder: true },
              { title: 'Reply When a Majority Acks', placeholder: true },
              { title: 'Fail the Client When the Timeout Fires First', placeholder: true },
            ],
          },
          {
            id: 'reads',
            kicker: 'Chapter 2',
            title: 'Reads That Stay Fresh',
            labs: [
              { title: 'Quorum Read vs Local Read', placeholder: true },
              { title: 'Alice Writes, Bob Reads Stale From Cyrene', placeholder: true },
              { title: 'Version Stamps and Newest Wins', placeholder: true },
              { title: 'Delayed Ack Turns Success Into Timeout', placeholder: true },
            ],
          },
          {
            id: 'partitions',
            kicker: 'Chapter 3',
            title: 'Partitions and Exploration',
            labs: [
              { title: 'Isolate One Replica Mid-Write', placeholder: true },
              { title: 'Asymmetric Link: One Direction Only', placeholder: true },
              { title: 'Find a Violating Seed, Then Fix It', placeholder: true },
              { title: 'Capstone: Quorum Under a Fixed Fault Schedule', placeholder: true },
            ],
          },
          {
            id: 'primary-backup',
            kicker: 'Chapter 4',
            title: 'Primary–Backup and Fencing',
            labs: [
              { title: 'Sync Replication Before Ack', placeholder: true },
              { title: 'Backup Takes Over on Primary Crash', placeholder: true },
              { title: 'Split-Brain When Both Think They Lead', placeholder: true },
              { title: 'Fencing Token Stops the Old Primary', placeholder: true },
            ],
          },
        ],
      },
      {
        id: 'consensus',
        label: 'Consensus',
        subtitle: 'One log, one history',
        tileBlurb:
          'Elect a leader, replicate a log to a majority, commit, persist, then serve a small KV. Raft on the deterministic harness — deep build also at /minors/consensus.',
        blurb:
          'Second protocol family: Raft. Election, AppendEntries, commit and apply, durable state, client API. Partitions and crashes are scheduled in ticks. Deep implement path: /minors/consensus.',
        challengeIds: [],
        chapters: [
          {
            id: 'election',
            kicker: 'Chapter 1',
            title: 'Election',
            labs: [
              { title: 'Terms, Votes, and Becoming Leader', placeholder: true },
              { title: 'Election Timeout in Ticks', placeholder: true },
              { title: 'Minority Partition Cannot Win', placeholder: true },
              { title: 'At Most One Leader Per Term', placeholder: true },
            ],
          },
          {
            id: 'log-replication',
            kicker: 'Chapter 2',
            title: 'Log Replication',
            labs: [
              { title: 'AppendEntries Consistency Check', placeholder: true },
              { title: 'Conflict Index and Catch-Up', placeholder: true },
              { title: 'Stale RPC Must Not Truncate', placeholder: true },
              { title: 'Divergent Leader Log Replaced', placeholder: true },
            ],
          },
          {
            id: 'commit',
            kicker: 'Chapter 3',
            title: 'Commit and Apply',
            labs: [
              { title: 'Majority Ack Advances commitIndex', placeholder: true },
              { title: 'Apply in Order, Exactly Once Under Dupes', placeholder: true },
              { title: 'Old-Term Entry Does Not Commit by Counting', placeholder: true },
              { title: 'Committed Prefix Survives Leader Change', placeholder: true },
            ],
          },
          {
            id: 'persistence',
            kicker: 'Chapter 4',
            title: 'Persistence and Restart',
            labs: [
              { title: 'term and votedFor Survive Crash', placeholder: true },
              { title: 'Visible vs Durable on the Simulated Disk', placeholder: true },
              { title: 'Crash Loop on a Lossy Network', placeholder: true },
              { title: 'Whole-Cluster Restart Under a Seed', placeholder: true },
            ],
          },
          {
            id: 'clients',
            kicker: 'Chapter 5',
            title: 'Clients and Linearizability',
            labs: [
              { title: 'Put / Get / Delete Through the Leader', placeholder: true },
              { title: 'Follower Redirect Hint', placeholder: true },
              { title: 'Duplicate Client Requests', placeholder: true },
              { title: 'Capstone: Partitions, Crashes, and a Checkable History', placeholder: true },
            ],
          },
        ],
      },
      {
        id: 'transactions',
        label: 'Transactions',
        subtitle: 'Atomic commit across nodes',
        tileBlurb:
          'Two-phase commit on the same harness. Crash the coordinator after prepare; prove participants do not diverge when you replay the seed.',
        blurb:
          'Third protocol family: atomic commitment (2PC) and recovery under uncertainty. Same tick-driven network and disk; graded on safety of the commit/abort decision under seeded faults.',
        challengeIds: [],
        chapters: [
          {
            id: 'two-phase-commit',
            kicker: 'Chapter 1',
            title: 'Two-Phase Commit',
            labs: [
              { title: 'Prepare, Then Commit Across Participants', placeholder: true },
              { title: 'Coordinator Crash After Prepare', placeholder: true },
              { title: 'Participant Timeout and Uncertainty', placeholder: true },
              { title: 'Recovery Log Decides Commit or Abort', placeholder: true },
            ],
          },
          {
            id: 'exploration',
            kicker: 'Chapter 2',
            title: 'Seeded Exploration',
            labs: [
              { title: 'Random Coordinator and Participant Faults', placeholder: true },
              { title: 'No Split Decision Under the Checker', placeholder: true },
              { title: 'Find a Violating Seed, Then Fix It', placeholder: true },
              { title: 'Capstone: 2PC Under a Fixed Fault Schedule', placeholder: true },
            ],
          },
        ],
      },
    ],
  },
];

const DOMAIN_IDS = new Set<string>(PLAY_DOMAINS.map((d) => d.id));

export function isPlayDomainId(id: string | null | undefined): id is PlayDomainId {
  return Boolean(id && DOMAIN_IDS.has(id));
}

/** True for /track/:sessionId ids (UUID or legacy spark-*), not catalog domain slugs. */
export function looksLikePlaySessionId(id: string | null | undefined): boolean {
  if (!id) return false;
  if (id.startsWith('spark-')) return true;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

export function playCatalogPath(
  domainId?: string | null,
  panelId?: string | null,
): string {
  if (!domainId || !isPlayDomainId(domainId)) return '/track';
  if (!panelId) return `/track/${domainId}`;
  return `/track/${domainId}/${panelId}`;
}

/** Catalog membership for flat Play list (domain + panel metadata). */
export interface PlayCatalogEntry {
  challengeId: string;
  domainId: PlayDomainId;
  domainLabel: string;
  panelId: PlayPanelId;
  panelLabel: string;
}

/** Ordered catalog rows across all tracks (preserves playCatalog order). */
export function listPlayCatalogEntries(): PlayCatalogEntry[] {
  const rows: PlayCatalogEntry[] = [];
  for (const domain of PLAY_DOMAINS) {
    for (const panel of domain.panels) {
      for (const challengeId of panel.challengeIds) {
        rows.push({
          challengeId,
          domainId: domain.id,
          domainLabel: domain.label,
          panelId: panel.id,
          panelLabel: panel.label,
        });
      }
    }
  }
  return rows;
}

/** Topic chips = technology panels that have at least one lab. */
export function listPlayTopics(): Array<{ id: string; label: string; domainId: PlayDomainId; count: number }> {
  const topics: Array<{ id: string; label: string; domainId: PlayDomainId; count: number }> = [];
  for (const domain of PLAY_DOMAINS) {
    for (const panel of domain.panels) {
      if (panel.challengeIds.length === 0) continue;
      topics.push({
        id: panel.id,
        label: panel.label,
        domainId: domain.id,
        count: panel.challengeIds.length,
      });
    }
  }
  return topics;
}

/** Back to the right shelf after a session ends or fails to start. */
export function catalogPathForChallenge(
  challengeId?: string | null,
  sandboxType?: string | null,
  tags?: string[] | null,
): string {
  if (challengeId === SPARK_PLAYGROUND_CHALLENGE_ID) return '/track/spark-playground';
  if ((sandboxType || '') === 'board') {
    return whiteboardSectionPath(whiteboardSectionForTags(tags).id);
  }
  for (const domain of PLAY_DOMAINS) {
    for (const panel of domain.panels) {
      if (panel.challengeIds.includes(challengeId || '')) {
        return playCatalogPath(domain.id, panel.id);
      }
    }
  }
  return '/track';
}

/**
 * Shelf URL that keeps a not-yet-started (or still-booting) lab open across
 * reload. Cleared once the real `/track/<sessionId>` URL takes over.
 */
export function catalogLabPath(
  challengeId: string,
  sandboxType?: string | null,
  tags?: string[] | null,
): string {
  const base = catalogPathForChallenge(challengeId, sandboxType, tags);
  return `${base}?lab=${encodeURIComponent(challengeId)}`;
}

export function getPlayDomain(id: PlayDomainId | null | undefined): PlayDomain | null {
  if (!id) return null;
  return PLAY_DOMAINS.find((d) => d.id === id) || null;
}

export function getPlayPanel(
  domain: PlayDomain | null | undefined,
  panelId: PlayPanelId | null | undefined,
): PlayPanel | null {
  if (!domain || !panelId) return null;
  return domain.panels.find((p) => p.id === panelId) || null;
}
// Force HMR reload - Tue Sep  1 19:19:50 IST 2026
