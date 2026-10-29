# Kafka labs — architecture and capacity

Platforms Engineer, Kafka panel. A lab is one pod on the `labs-kafka` pool. The pod is the cluster. It is created when the lab opens and deleted when the lab ends, the same way a Linux box is. Learners do not share a cluster: the labs stop brokers, fill a disk, and change replication.

The pool is a managed node group (`labs-kafka`, one `t4g.medium`) plus an optional Karpenter overflow (`labs-kafka-elastic`). It is tainted `devlabs.io/pool=kafka:NoSchedule` and is not in `EKS_NODEGROUPS`, so a normal sleep leaves it alone. Park it with `./deploy/eks/eks-kafka.sh sleep`.

```bash
./deploy/eks/eks-kafka.sh base     # one node, enough for the trial
./deploy/eks/eks-kafka.sh trial    # base + the three-broker spike, then print memory
./deploy/eks/eks-kafka.sh sleep    # desired → 0
```

## What is inside the pod

Containers in one pod share a network namespace, so the brokers cannot all listen on 9092. Each binds its own ports on `127.0.0.1`. The learner's shell is a fourth container. The Kafka CLI starts its own JVM there, with a 64 MB heap, so a `kafka-topics --describe` does not add to a broker's memory.

| Container | Process | Client port | Heap |
| --- | --- | --- | --- |
| `kafka-0` | broker + controller, node 1 | 9092 | 192 MB |
| `kafka-1` | broker + controller, node 2 | 9093 | 192 MB |
| `kafka-2` | broker + controller, node 3 | 9094 | 192 MB |
| `shell` | `sleep`, plus the CLI when the learner runs one | — | 64 MB for the CLI only |

Image: `apache/kafka:3.9.1` (arm64, KRaft, no ZooKeeper). Combined mode is three processes, not three brokers plus three controllers. There is no operator in the pod. An operator would restart a broker the lab just stopped.

Inter-broker traffic uses a second listener (`PLAINTEXT` on 19092 / 29092 / 39092). The controller quorum is `127.0.0.1` on 19093 / 29093 / 39093. Client commands use `--bootstrap-server 127.0.0.1:9092`. That bootstrap returns the other two client ports, which resolve inside the pod.

Each broker has its own emptyDir (`sizeLimit: 1Gi`). The disk-full lab will shrink one of those to 64 Mi, the same idea as the 64 Mi mount on the Linux disk-full lab, so a full log does not fill the node.

Two shapes, not one per lab:

| Shape | Labs | Request | Limit |
| --- | --- | --- | --- |
| `kafka-3` | 00, 01, 02, 03, 04, 05, 09, and shelf 2 | 3 × 256 Mi + 64 Mi shell = **832 Mi**, 175m CPU | 3 × 384 Mi + 256 Mi shell |
| `kafka-1` | 06, 07, 08 | 256 Mi + 64 Mi = **320 Mi**, 75m CPU | 384 Mi + 256 Mi |

`kafka-1` drops two broker containers. Same image, same shell. Lab 01 stays on `kafka-3`: creating `notifications` at replication factor 3 is the lesson, and a single broker cannot do that. `kafka-1` is for the labs whose lesson is a topic setting or a consumer group.

Shelf 2's listener lab needs a second, small client pod in the same namespace, because every container here shares loopback. That pod is not part of this spike.

## Trial

`deploy/eks/kafka/trial-kafka3.yaml`, applied by `eks-kafka.sh trial`. One `kafka-3` pod. After the quorum forms it creates `payments` (6 partitions, replication factor 3), describes it, and prints the KRaft quorum status.

The first boot used a 768 Mi broker limit so a wrong guess would show up as a number rather than an OOM. It did OOM, for a specific reason: Kafka’s log cleaner allocates `log.cleaner.dedupe.buffer.size`, whose default is 128 MB, and that allocation does not fit in a 192 MB heap. The manifest sets it to 16 MB (`KAFKA_LOG_CLEANER_DEDUPE_BUFFER_SIZE=16777216`). With that set, the same pod started cleanly.

### Measured (28 Oct 2026)

Cluster `devlabs`, node group `labs-kafka`, one `t4g.medium` in ap-south-2. Image `apache/kafka:3.9.1`. Heap `-Xms192m -Xmx192m` with SerialGC. Sampled from cgroup `memory.current` / `memory.peak` after the quorum was up and again after creating and describing `payments`. `kubectl top` agreed within a few tens of Mi.

| Container | Idle, cgroup | After the CLI, cgroup | Peak |
| --- | --- | --- | --- |
| `kafka-0` (controller leader) | 179 Mi | 184 Mi | 187 Mi |
| `kafka-1` | 138 Mi | 171 Mi | 175 Mi |
| `kafka-2` | 136 Mi | 172 Mi | 175 Mi |
| `shell` | 1 Mi | 2 Mi once the CLI exited | 72 Mi during the CLI |

The three brokers together sat at about **530 Mi** after the describe. Adding the shell’s CLI peak, the pod touched about **600 Mi** for a moment. CPU while describing was about 30–50m per broker and 66m on the shell. Idle brokers were under 50m.

The node reported allocatable **1930m CPU**, **3423076 Ki (3343 Mi)** memory, **12 pods**. Four DaemonSets were already there (`aws-node`, `kube-proxy`, `ebs-csi-node`, `eks-pod-identity-agent`) and together requested about 100 Mi. That leaves about 3240 Mi for lab pods.

A broker request of 256 Mi is a third above the 187 Mi peak. A limit of 384 Mi is about twice that peak, so a leak dies in the container. The shell peaked at 72 Mi on a describe; its limit is 256 Mi because a reassignment has not been measured yet and will allocate more.

This sample is an empty quorum plus one small topic. A reassignment or a disk-full lab can push a broker higher. Those labs should be measured again before the limit comes down further.

## Packing

`t4g.medium` is 2 vCPU / 4 GiB. The launch template reserves `11 × 12 + 255 = 387 Mi` for the kubelet (`maxPods: 12`). Memory is the cap. CPU is not: three brokers at 50m each are a small slice of the 1930m allocatable.

At **832 Mi** requested, **three** `kafka-3` sessions fit (2496 Mi) and a fourth does not. `kafka-1` at 320 Mi would fit about ten by memory, and the pod cap stops it at eight (12 slots minus the four DaemonSets). A Linux box requests 64 Mi (about 43 per node). A Docker box requests 256 Mi (about 12). Kafka is still the expensive track. Only the labs that stop a broker or change replication pay for three of them.

Overflow is `eks-kafka.sh up`, capped at two extra nodes. The trial node was parked after the measurement (`eks-kafka.sh sleep`). `eks-kafka.sh wake` brings the base node back.
