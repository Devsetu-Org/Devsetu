# Solution — Open a Topic the Platform Way

1. Read `~/ticket/PLATFORM.md` (ignore the wrong numbers in `TICKET.md`).
2. Create `order.status` with 6 partitions, RF 3, `retention.ms=259200000`, `min.insync.replicas=2`, `cleanup.policy=delete`.
3. Leave the three live topics alone.
4. Investigation: `controlPlane=kraft`, `shapeSource=platform-note`, partitions `6`, RF `3`, retention `259200000`, min.ISR `2`.

Local e2e: `./solution/validate-local.sh` (Docker, three KRaft brokers).
