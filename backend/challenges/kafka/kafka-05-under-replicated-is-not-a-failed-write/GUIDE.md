# QuickBite — URP ≠ failed produce

`kafka-2` is stopped. Produces with `acks=all` can still succeed while min.ISR=2.

## 1. See the plant

```bash
kafka-topics.sh --bootstrap-server "$BOOTSTRAP_SERVERS" --describe --topic rider.dispatch
```

## 2. Bring kafka-2 back

On **kafka-2**:

```bash
qb-broker start
```

## 3. Wait for ISR=3 on every partition

Do not lower min.ISR. Do not enable unclean election. Do not force a leader election.
