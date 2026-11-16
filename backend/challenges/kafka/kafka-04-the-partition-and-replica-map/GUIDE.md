# QuickBite Data Platform — partition and replica map (KRaft)

Study **`rider.dispatch`**. Do not change the cluster.

## 1. Describe the topic

```bash
kafka-topics.sh --bootstrap-server "$BOOTSTRAP_SERVERS" \
  --describe --topic rider.dispatch

kafka-configs.sh --bootstrap-server "$BOOTSTRAP_SERVERS" \
  --describe --entity-type topics --entity-name rider.dispatch --all
```

For **partition 0**, record leader, replicas (preferred = first id), ISR,
`min.insync.replicas`, and `unclean.leader.election.enable`.

## 2. RF vs ISR vs min.ISR

- **RF** — how many replicas the topic should have.
- **ISR** — which replicas are caught up now.
- **min.insync.replicas** — how many ISR members `acks=all` needs.

## 3. Three predictions (one broker dies)

| Case | RF | min.ISR | Produce after one broker dies? |
|------|----|---------|--------------------------------|
| A | 3 | 2 | Still OK if ISR stays ≥ 2 |
| B | 3 | 3 | Fails — ISR cannot stay at 3 |
| C | 2 | 2 | Fails — ISR cannot stay at 2 |

## 4. Investigation

Fill the map fields and the three prediction dropdowns. Then Submit.
