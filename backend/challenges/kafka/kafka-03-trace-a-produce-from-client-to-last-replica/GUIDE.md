# QuickBite Data Platform — trace one produce (KRaft)

| Host      | Role                                     |
|-----------|------------------------------------------|
| `kafka-0` | Combined broker + controller (node id 1) |
| `kafka-1` | Combined broker + controller (node id 2) |
| `kafka-2` | Combined broker + controller (node id 3) |
| `shell`   | CLI (`BOOTSTRAP_SERVERS`)                |

Leave topic shapes alone. This lab is one keyed write into `rider.dispatch`.

## 1. Read the ticket

```bash
less ~/ticket/PRODUCE.md
```

## 2. Produce with acks=all

From the **shell**, using `$BOOTSTRAP_SERVERS`:

```bash
printf '%s\n' 'ride-9917:{"status":"assigned"}' | \
  kafka-console-producer.sh \
    --bootstrap-server "$BOOTSTRAP_SERVERS" \
    --topic rider.dispatch \
    --property parse.key=true \
    --property key.separator=: \
    --producer-property acks=all
```

## 3. Map key → partition → leader → ISR

```bash
kafka-topics.sh --bootstrap-server "$BOOTSTRAP_SERVERS" \
  --describe --topic rider.dispatch
```

Find the partition for `ride-9917`. Record **Leader** and **Isr** for that partition.

```bash
kafka-console-consumer.sh --bootstrap-server "$BOOTSTRAP_SERVERS" \
  --topic rider.dispatch --from-beginning --property print.key=true \
  --property print.partition=true --property print.offset=true \
  --timeout-ms 10000 | grep ride-9917
```

## 4. Log end on the partition

```bash
kafka-get-offsets.sh --bootstrap-server "$BOOTSTRAP_SERVERS" \
  --topic rider.dispatch --time -1
```

After `acks=all`, every in-sync replica has caught up to that end offset.

## 5. Investigation

Record bootstrap source, key, partition, leader broker id, ISR (sorted ascending), and the log-end offset. Then Submit.
