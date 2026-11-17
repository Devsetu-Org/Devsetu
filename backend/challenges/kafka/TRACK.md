# Kafka track — Platforms Engineer

Platforms Engineer, Kafka panel. Packs will live in `backend/challenges/packs/kafka-*.json` and are listed on the Kafka shelf in `frontend/src/constants/playCatalog.ts`.

Curriculum design: `docs/kafka-curriculum-draft.csv`.

Runtime: shapes from `deploy/eks/kafka/README.md` and `workspace/kafkaBox.ts`:
`kafka-zk-3` (Lab 1: ZooKeeper + 3 classic brokers), `kafka-3` (Lab 2+: KRaft combined), later `kafka-1` / `kafka-4` / Kafka-on-K8s. Pool: `devlabs.io/pool=kafka` (`./deploy/eks/eks-kafka.sh`). Images: `apache/kafka:3.9.1`, `zookeeper:3.9`. Helpers: `backend/challenges/kafka/_lib/lab.sh`.

**Story.** QuickBite already runs `orders`, `rider.dispatch`, and `restaurant.notifications`. The learner runs the brokers and the platform path around them—not the producer/consumer app code.

**Evolution.** Lab 1 is intentionally **ZooKeeper-era** so learners see how the control plane used to work. From Lab 2 onward the track is **KRaft** (no ZooKeeper).

**Design note.** Chapter *buckets* rhyme with the Spark shelf for panel UX. Lab sequences are Kafka-first—do not chase Spark title parity.

The prior ops shelf (`kafka-00` … `kafka-09`) is **Backlog**. Reuse lesson DNA where it fits; ship **new pack ids** for active chapters.

## Chapter 1 — Foundations of a Kafka Cluster

Shape: **Lab 1** `kafka-zk-3`; **Labs 2–8** `kafka-3` (KRaft).

Arc: ZooKeeper-era layout → open a topic on KRaft → follow a write → replica map → URP vs failed produce → min.ISR → disk/segments → stacked capstone.

| Lab | Title | Kind | Diff | Status |
| --- | --- | --- | --- | --- |
| kafka-01 | Stand Up the Cluster and Find Everything on Disk | orientation | L0 | Open (`finalized: true`, ZooKeeper + Investigation) |
| kafka-02 | Open a Topic the Platform Way | orientation | L0 | Planned (KRaft) |
| kafka-03 | Trace a Produce From Client to Last Replica | orientation | L0 | Planned (KRaft) |
| kafka-04 | The Partition and Replica Map | orientation | L0 | Planned (KRaft) |
| kafka-05 | Under-Replicated Is Not a Failed Write | multi-step-bug | L1 | Planned (KRaft) |
| kafka-06 | min.ISR Is Why Produces Fail | multi-step-bug | L1 | Planned (KRaft) |
| kafka-07 | Segments, Retention, and Why Disk Fills | multi-step-bug | L1 | Planned (KRaft) |
| kafka-08 | Capstone: Disk, ISR, and the Write Path | capstone | L2 | Planned (KRaft) |

### kafka-01

`shape: kafka-zk-3`. ZooKeeper + three classic brokers already up. Setup plants live topics, decoy `/opt/zookeeper/data` + `/opt/kafka/kafka-logs`, and a wrong handoff. Learner records ZK + broker PIDs, finds live ZK `dataDir` (`/data`) and Kafka `log.dirs` (`/var/lib/kafka/data` via process env), reads controller from `zookeeper-shell get /controller`. Investigation: logDirsSource=`process-env`, controlPlane=`zookeeper`. Grade rejects decoys and KRaft answers. Local e2e: `solution/validate-local.sh`.

### kafka-02

**KRaft from here.** Create `order.status` to platform shape (partitions, RF, retention, min.ISR). Existing topics untouched. Ticket template may be wrong. Guide should note there is no ZooKeeper on this cluster.

### kafka-03

Seeded `rider.dispatch`. Produce one keyed record; answer files for leader, ISR, end offsets per replica.

### kafka-04

Worksheet / Investigation: RF, ISR, preferred leader, min.ISR, unclean election. Predict three broker-death cases. No cluster break required.

### kafka-05

One broker stopped. Produces still succeed; URP non-zero. Start broker; wait ISR=3; leave min.ISR and unclean flags alone.

### kafka-06

RF too low for min.ISR with a broker down → produce failures. Ticket pushes min.ISR=1. Refuse; restore RF + broker.

### kafka-07

Full log dir: debug topic + keep-forever. Free disk; teach delete vs compact (status changelog is the compact one). Hot path retention left alone unless ticket says otherwise.

### kafka-08

Capstone stacking 1.5–1.7: leader disk full, produces fail on some partitions, group behind on those partitions. No unclean election, no min.ISR=1, no reset to latest.

## Chapter 2 — Consumer Groups and Read Position

Shape: `kafka-3` or `kafka-1` where replication is not the lesson.

| Lab | Title | Kind | Diff | Status |
| --- | --- | --- | --- | --- |
| kafka-09 | Meet the Consumer Group | orientation | L0 | Planned |
| kafka-10 | One Partition Stuck the Desk | multi-step-bug | L1 | Planned |
| kafka-11 | Put the Offsets Back | multi-step-bug | L1 | Planned |
| kafka-12 | The Group Never Stays Stable | multi-step-bug | L1 | Planned |
| kafka-13 | Replay Ate the Request Path | multi-step-bug | L2 | Planned |

## Chapter 3 — Kafka on Kubernetes

Packs not built; needs Kafka-on-K8s runtime shape.

| Lab | Title | Kind | Diff | Status |
| --- | --- | --- | --- | --- |
| kafka-14 | Broker Identity Is the PVC | orientation | L0 | Planned |
| kafka-15 | Clients Are Calling an Address Brokers Do Not Advertise | multi-step-bug | L1 | Planned |
| kafka-16 | Roll One Broker at a Time | multi-step-bug | L1 | Planned |
| kafka-17 | StorageClass and the Broker That Never Joins | multi-step-bug | L1 | Planned |
| kafka-18 | Bootstrap, Namespace, and Listener Drift | capstone | L2 | Planned |

Listener / advertised / cluster-id style faults live here (and in Incidents), not as a Chapter 1 “post-maintenance” mirror.

## Chapter 4 — Platform Automations

Topic-as-code, ACL/quota provision, fail-closed, drift → repair, request API.

| Lab | Title | Kind | Diff | Status |
| --- | --- | --- | --- | --- |
| kafka-19 | Topic Shape as Desired State | orientation | L0 | Planned |
| kafka-20 | ACL and Quota From the Request File | multi-step-bug | L1 | Planned |
| kafka-21 | Refuse RF=1 and Keep-Forever | multi-step-bug | L1 | Planned |
| kafka-22 | Print Drift, Then Repair | multi-step-bug | L1 | Planned |
| kafka-23 | Topic Request API | multi-step-bug | L1 | Planned |

## Chapter 5 — Capacity, Leadership, and Placement

Reports, hot partitions, reassignment onto a new broker, planned leadership shed—Kafka placement, not “add executors.”

| Lab | Title | Kind | Diff | Status |
| --- | --- | --- | --- | --- |
| kafka-24 | Under-Replicated Report | orientation | L0 | Planned |
| kafka-25 | Lag Report for Dispatch | orientation | L0 | Planned |
| kafka-26 | One Key Owns the Topic | multi-step-bug | L1 | Planned |
| kafka-27 | Move Replicas Onto the Empty Broker | multi-step-bug | L1 | Planned |
| kafka-28 | Shed Leadership Before the Patch | multi-step-bug | L1 | Planned |

## Chapter 6 — Incidents

| Lab | Title | Kind | Diff | Status |
| --- | --- | --- | --- | --- |
| kafka-29 | Leader Disk Full, Desk Behind | capstone | L2 | Planned |
| kafka-30 | Offsets After the Firefight | multi-step-bug | L1 | Planned |
| kafka-31 | Two Topics, One Full Broker | multi-step-bug | L2 | Planned |
| kafka-32 | Drain While the Cluster Is Already Hurting | multi-step-bug | L2 | Planned |
| kafka-33 | Quota, Listener, and Disk Together | capstone | L2 | Planned |

## Backlog pool

Prior ops shelf. Built packs may stay finalized; they are out of the active sequence.

| Lab | Title | Notes |
| --- | --- | --- |
| kafka-00 … kafka-09 | Prior ops shelf | Lesson DNA → Foundations 1.2/1.5–1.8 and Consumer Groups 2.2–2.3 when rebuilt under new ids |

## What this track is not

- Not a producer/consumer coding course.
- Not ZooKeeper (KRaft only).
- Not a line-by-line remake of the Spark foundations list.
