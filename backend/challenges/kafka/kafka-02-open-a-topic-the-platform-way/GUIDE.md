# QuickBite Data Platform — open a topic the platform way (KRaft)

This lab is **KRaft**. Each `kafka-*` host is broker **and** controller. There is **no** ZooKeeper pod and no `/controller` znode.

| Host      | Role                                      |
|-----------|-------------------------------------------|
| `kafka-0` | Combined broker + controller (node id 1)  |
| `kafka-1` | Combined broker + controller (node id 2)  |
| `kafka-2` | Combined broker + controller (node id 3)  |
| `shell`   | CLI (`BOOTSTRAP_SERVERS`)                 |

Leave `orders`, `rider.dispatch`, and `restaurant.notifications` alone.

## 1. Read the ticket — then the platform note

```bash
less ~/ticket/TICKET.md
less ~/ticket/PLATFORM.md
```

The ticket can be wrong. **PLATFORM.md** is the QuickBite shape for `order.status`.

## 2. Create `order.status`

From the **shell**:

```bash
kafka-topics.sh --bootstrap-server "$BOOTSTRAP_SERVERS" --create \
  --topic order.status \
  --partitions 6 \
  --replication-factor 3 \
  --config retention.ms=259200000 \
  --config min.insync.replicas=2 \
  --config cleanup.policy=delete
```

Confirm:

```bash
kafka-topics.sh --bootstrap-server "$BOOTSTRAP_SERVERS" --describe --topic order.status
kafka-configs.sh --bootstrap-server "$BOOTSTRAP_SERVERS" \
  --describe --entity-type topics --entity-name order.status --all
```

Every partition should show three replicas in the ISR.

## 3. Prove you did not touch the live topics

```bash
kafka-topics.sh --bootstrap-server "$BOOTSTRAP_SERVERS" --describe --topic orders
kafka-topics.sh --bootstrap-server "$BOOTSTRAP_SERVERS" --describe --topic rider.dispatch
kafka-topics.sh --bootstrap-server "$BOOTSTRAP_SERVERS" --describe --topic restaurant.notifications
```

## 4. Investigation

Record that this control plane is KRaft, that you followed the platform note (not the wrong ticket), and the shape numbers you applied. Then Submit.
