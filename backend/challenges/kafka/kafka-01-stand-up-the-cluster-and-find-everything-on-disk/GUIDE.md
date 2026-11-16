# QuickBite Data Platform — Kafka + ZooKeeper on-disk orientation

This lab is the **classic** layout. ZooKeeper holds cluster metadata and elects
the controller. Brokers are brokers only. Later labs use **KRaft** (combined
broker + controller, no ZooKeeper). Know both.

| Host         | Role in this lab                            |
|--------------|---------------------------------------------|
| `zookeeper`  | ZooKeeper (client port 2181)                |
| `kafka-0`    | Broker id 1                                 |
| `kafka-1`    | Broker id 2                                 |
| `kafka-2`    | Broker id 3                                 |
| `shell`      | CLI (`BOOTSTRAP_SERVERS`, `ZOOKEEPER_CONNECT`) |

Switch hosts from the bar above. Leave `orders`, `rider.dispatch`, and
`restaurant.notifications` alone.

## 1. Confirm processes

On **zookeeper**:

```bash
ps -eo pid,args | grep -i '[q]uorumPeer\|[z]ookeeper\|[o]rg.apache.zookeeper'
```

On each **kafka-*** host:

```bash
ps -eo pid,args | grep -i '[k]afka\|org.apache.kafka'
```

## 2. Find directories (distrust the handoff)

`~/ticket/HANDOFF.md` on the shell names paths. They may be stale.

**Kafka log.dirs** — on a broker, from the live process:

```bash
tr '\0' '\n' < /proc/PID/environ | grep -E 'LOG_DIR|log.dirs'
ls -la "$LOG_DIR"
```

A decoy directory may exist. If it has no real partition logs for the live
topics, you are looking at the wrong path.

**ZooKeeper dataDir** — on `zookeeper`, confirm the live data directory
(this image uses `/data`; look for `myid` / version files). A decoy folder may
exist under `/opt`.

## 3. Who is the controller?

With ZooKeeper, the active controller is a znode — not a KRaft quorum status.

On the **shell**:

```bash
zookeeper-shell.sh "$ZOOKEEPER_CONNECT" get /controller
```

Parse `brokerid` from the JSON. Do **not** use `kafka-metadata-quorum.sh` on this lab.

## 4. How this cluster is shaped

- Control plane: **ZooKeeper**
- Each `kafka-*` host: **broker only** (controller is elected among brokers via ZK)
- Log directories and ZK data directories come from the **live process / image config**, not the handoff note

## 5. Investigation

Record PIDs, ZK data dir, Kafka log dir, controller broker id, how you found
the Kafka log dir, and the control-plane dropdown. Then Submit.
