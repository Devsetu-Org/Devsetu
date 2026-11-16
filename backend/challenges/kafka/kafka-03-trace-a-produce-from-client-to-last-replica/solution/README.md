# Solution — Trace a Produce From Client to Last Replica

1. Produce `ride-9917:{"status":"assigned"}` to `rider.dispatch` with `acks=all` via `$BOOTSTRAP_SERVERS`.
2. Consumer-print partition/offset for that key; describe for Leader + ISR.
3. `kafka-get-offsets.sh --time -1` for the log-end on that partition.
4. Investigation: `bootstrapSource=env-bootstrap`, key `ride-9917`, plus live partition/leader/ISR/end.

On-cluster: `npx tsx challenges/kafka/_lib/validate-on-cluster.mjs kafka-03-trace-a-produce-from-client-to-last-replica`
