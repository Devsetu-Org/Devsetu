# Kafka track — first ten labs

Platforms Engineer, Kafka panel. The ten packs are in `backend/challenges/packs/kafka-*.json` and listed on the Kafka shelf in `frontend/src/constants/playCatalog.ts`. kafka-01 is `finalized: true` and starts a kafka-3 cluster: three broker pods and a shell pod (`setup.sh`, `grade.sh`). The other nine stay `finalized: false` until their scripts exist.

Ridely already runs trips, matches, and alerts on this cluster. The learner is on call for the brokers. They do not write a producer.

Two pod shapes, from `deploy/eks/kafka/README.md`:

| Shape | Labs |
| --- | --- |
| `kafka-3` | 00, 01, 02, 03, 04, 05, 09 |
| `kafka-1` | 06, 07, 08 |

`kafka-1` is one broker. Replication factor 3 is not possible there, so lab 01 stays on `kafka-3`. The shell has `BOOTSTRAP_SERVERS` set to the three broker DNS names, and the Kafka scripts on `PATH`. Client heap is 64 MB.

A healthy `kafka-3` lab starts from the trial pod: three combined KRaft brokers, offsets topic at 3 partitions and replication factor 3, cleaner dedupe buffer 16 MB. `setup.sh` then breaks one thing.

---

## kafka-00 — First shift on the Kafka cluster

Shape: `kafka-3`. Difficulty: L0.

**Situation.** First shift on QuickBite's Data Platform Kafka. The cluster is already up. `orders`, `restaurant.notifications`, and `rider.dispatch` are live; what each carries is in the Intro. Leftover topic `scratch` must be deleted. The learner writes down the controller, the leader of `rider.dispatch` partition 3, and how far that partition has been written.

**Task.**

1. Write the controller broker id to `~/answers/controller`.
2. Write the leader of `rider.dispatch` partition 3 to `~/answers/rider-dispatch-3-leader`.
3. Write that partition's log end to `~/answers/rider-dispatch-3-end`.
4. Delete `scratch`.

**Spec.**

- The end offset is the position after the last record on that partition, not the last stable offset.

**Setup.** Create `orders` and `rider.dispatch` with 6 partitions, and `restaurant.notifications` with 3. Replication factor 3, `min.insync.replicas=2`. Produce six records round-robin onto `rider.dispatch` so partition 3 is not empty. Create `scratch` with 1 partition and replication factor 1. All three brokers running.

**Grade.** Answer files match `kafka-metadata-quorum.sh describe --status` and `kafka-get-offsets.sh --topic rider.dispatch --partitions 3 --time -1`. `scratch` does not exist.

---

## kafka-01 — Open the order status topic

Shape: `kafka-3`. Difficulty: L0.

**Situation.** `orders`, `rider.dispatch`, and `restaurant.notifications` are already live. The ordering service needs `order.status` for preparation, pickup, and delivery. The ticket template says one replica and keep-forever. That template is wrong. The spec below is the one QuickBite uses for a new stream, matching `orders`.

**Task.** Create `order.status` to the spec. Do not change the three topics already live.

**Spec.**

- Name: `order.status`
- Partitions: 6
- Replication factor: 3
- `retention.ms`: 259200000 (3 days)
- `min.insync.replicas`: 2
- Cleanup policy stays `delete`
- `restaurant.notifications` stays at 3 partitions. `orders` and `rider.dispatch` stay at 6.

**Setup.** Healthy cluster with `orders` and `rider.dispatch` at 6 partitions, `restaurant.notifications` at 3, replication factor 3, `min.insync.replicas=2`. No `order.status`.

**Grade.** `kafka-topics.sh --describe` and `kafka-configs.sh --describe --entity-type topics --entity-name order.status` match the spec. Every partition has three in-sync replicas. The three existing topics are untouched, including `restaurant.notifications` at 3 partitions and `retention.ms` `604800000`.

---

## kafka-02 — Orders-audit has one copy

Shape: `kafka-3`. Difficulty: L1.

**Situation.** `trips-audit` was created with one replica, and every partition is on `kafka-0`. That broker is patched tonight. If it stops, the audit log goes offline. Raise the replication factor to 3 before then. Leave the current leaders where they are.

**Task.** Reassign `trips-audit` so every partition has replicas on all three brokers, then wait until every in-sync set has three members.

**Spec.**

- Replication factor 3 on every `trips-audit` partition.
- ISR size 3 on every partition.
- The leader of each partition is the broker that led it when the lab opened.

**Setup.** `trips-audit`, 4 partitions, replication factor 1, all leaders and replicas on broker 1 (`kafka-0`). Record the leaders in a file the grader can read, outside the learner's home.

**Grade.** ISR is `{1,2,3}` on every partition. Leaders equal the recorded set. No other topic's replica placement changed.

---

## kafka-03 — Broker 2 left the ISR

Shape: `kafka-3`. Difficulty: L1.

**Situation.** `matches` is under-replicated. Producers are still succeeding. `kafka-2` is stopped. The page is `UnderReplicatedPartitions`, not a produce error. Bring the broker back and wait until every matches partition has three in-sync replicas. Do not run a leader election by hand, and do not delete data.

**Task.** Start `kafka-2`. Wait for the ISR.

**Spec.**

- `kafka-2` is running.
- Every `matches` partition has ISR size 3.
- `min.insync.replicas` is still 2.
- Unclean leader election is still off.

**Setup.** Stop the `kafka-2` container after the cluster is healthy. `matches` is replication factor 3, so each partition keeps a leader on `kafka-0` or `kafka-1`.

**Grade.** Process in `kafka-2` is up. `kafka-topics.sh --describe --topic matches --under-replicated-partitions` prints nothing. Config flags unchanged.

The learner cannot `systemctl` a broker. Starting `kafka-2` is a script on the shell, `qb-broker start kafka-2`, which the lab image provides. It signals that one container. The same helper is how later labs stop a broker. The learner does not get a way to kill the shell or the other brokers by name except the one the lab names.

---

## kafka-04 — Payments is rejecting writes

Shape: `kafka-3`. Difficulty: L1.

**Situation.** Produces to `matches` are failing. The topic was left at replication factor 2 with `min.insync.replicas=2`, and `kafka-1` is down, so the in-sync set has one broker. A note in the ticket says to set `min.insync.replicas=1` so the page goes green. Do not. Start `kafka-1`, raise the replication factor to 3, and leave the minimum at 2.

**Task.** Restore a produce path that still requires two in-sync replicas, and survive the next single broker failure.

**Spec.**

- `kafka-1` is running.
- `matches` replication factor is 3, ISR size is 3, `min.insync.replicas` is 2.
- A produce of one record succeeds.

**Setup.** Alter `matches` to replication factor 2 with replicas only on brokers 1 and 2 (so `kafka-2` is the survivor). Stop `kafka-1`. Leave `min.insync.replicas=2`.

**Grade.** Config and ISR as in the spec. `kafka-console-producer` of a single known record exits 0. The grader reads it back. `min.insync.replicas` was never 1 at grade time; the grade cannot see the past, so the spec is the end state only.

---

## kafka-05 — Disk full on broker 1

Shape: `kafka-3`. Difficulty: L2.

**Situation.** `kafka-1` keeps leaving the ISR. Its log directory is at 100%. Almost all of the bytes are `debug-dump`, a topic created during an incident with retention turned off. `trips` was also left on keep-forever. `matches` is small and must not be deleted or shortened.

**Task.**

1. Delete `debug-dump`.
2. Set `trips` retention to 7 days (`retention.ms=604800000`).
3. Leave `matches` alone.
4. `kafka-1` must be back in the ISR for `matches`.

**Spec.**

- `debug-dump` does not exist.
- `trips` `retention.ms` is 604800000. Its cleanup policy is still `delete`.
- `matches` retention is unchanged from the value recorded at setup.
- Disk on `kafka-1`'s log directory is under 80%.
- Every `matches` partition has ISR size 3.

**Setup.** `kafka-1`'s emptyDir is 64 Mi, the same idea as the Linux disk-full lab. `debug-dump` is filled with closed segments until the filesystem is at 100% and `kafka-1` has dropped out of the ISR. `trips` has `retention.ms=-1`. Segment size on `debug-dump` is small so a delete frees space inside the grade timeout. `matches` retention is recorded for the grader.

**Grade.** As in the spec. The grader checks the mount with `df` inside the `kafka-1` container.

---

## kafka-06 — Orders was compacted

Shape: `kafka-1`. Difficulty: L1.

**Situation.** Support says last week's trips are gone. `trips` was switched to `cleanup.policy=compact`, so Kafka kept the latest record per key and dropped the rest. `trip-status` is the changelog, one current status per ride, and it is still a delete topic. Put `trips` back to `delete`. Set `trip-status` to `compact`. Do not try to reproduce the missing trips. They are gone.

**Task.** Two config changes. Nothing else.

**Spec.**

- `trips` cleanup policy is `delete`.
- `trip-status` cleanup policy is `compact`.
- No new records were produced to `trips` by the learner. The grader records the end offset at setup and fails if it moved.

**Setup.** One broker. `trips` is `compact` and has already been cleaned, so the log is shorter than what was produced. `trip-status` exists as `delete`. Record the `trips` end offset.

**Grade.** Configs match. `trips` end offset equals the recorded value.

---

## kafka-07 — One partition of matches is behind

Shape: `kafka-1`. Difficulty: L1.

**Situation.** `match-desk` is behind on `matches` partition 4 only. The other partitions are caught up. The member assigned to partition 4 is wedged. Restart that instance. Do not reset the group's offsets. Lag has to fall because the consumer catches up.

**Task.** Restart `match-desk` instance 2. Wait until every partition's lag is below 10.

**Spec.**

- Group `match-desk` is stable.
- Lag on every `matches` partition is under 10.
- Committed offsets moved forward from the values recorded at the start of the lab. They did not jump to the log end in one step.

**Setup.** One broker, `matches` with 6 partitions, a few thousand records. Three fixture consumers in the group. Instance 2 is paused after it commits an early offset on partition 4, so lag grows only there. The fixture, once restarted, consumes quickly. Record committed offsets where the learner cannot edit them.

**Grade.** `kafka-consumer-groups.sh --describe --group match-desk`. Lag under 10. Each committed offset is greater than the recorded offset and less than the recorded offset plus the lag that existed at setup plus a small margin, so a `--to-latest` reset fails.

The restart command is `qb-service restart match-desk@2`.

---

## kafka-08 — Put the notification offsets back

Shape: `kafka-1`. Difficulty: L1.

**Situation.** During the last page someone ran `--reset-offsets --to-latest` on `alert-pager`. The records are still in the log. The 02:00 offsets are in `~/ticket/offsets.txt`, one `partition:offset` per line. Stop the group, reset to that file, and start the service again. Do not use `--to-earliest`. The backlog is nine days.

**Task.** Reset `alert-pager` to the ticket, then start it.

**Spec.**

- Committed offsets equal `~/ticket/offsets.txt`.
- The group is stable and the service process is running.
- Offsets were not left at the log end, and not at zero.

**Setup.** One broker. `alerts` has records well past the ticket offsets. The group's committed offsets are the log end. The service is stopped, so a reset is allowed. `~/ticket/offsets.txt` is written at setup. The real target is also stored outside the learner's home, in case they edit the ticket.

**Grade.** Committed offsets match the hidden target. Group state is Stable. `qb-service` reports `alert-pager` active.

---

## kafka-09 — Payments incident

Shape: `kafka-3`. Difficulty: L2.

**Situation.** Produces to some `matches` partitions are failing, and `match-desk` is behind on those same partitions. The other partitions are fine. `debug-dump` has filled `kafka-2`. That broker leads the failing partitions, and a full disk means the leader cannot append, so it stays leader. Two notes are in the ticket: turn on unclean leader election, or reset `match-desk` to latest. Do neither.

Free the disk, or stop `kafka-2` so an in-sync replica can take over. Bring `kafka-2` back only once it can write. Lag has to drain because the consumer catches up.

**Task.** `matches` accepts writes on every partition, the group catches up, and the two shortcuts are still off.

**Spec.**

- `debug-dump` is gone, or its retention is finite and the disk is under 80%.
- `min.insync.replicas` on `matches` is still 2.
- `unclean.leader.election.enable` is still false.
- Every `matches` partition has ISR size 3.
- `match-desk` committed offsets moved forward from the values recorded at setup, and lag on every partition is under 10.
- A produce to each `matches` partition succeeds.

**Setup.** Same 64 Mi log dir on `kafka-2` as lab 05, filled by `debug-dump`. Preferred leaders for three `matches` partitions are on `kafka-2`, and those are the current leaders. The consumer is healthy but stuck fetching from the wedged leaders. Record offsets and the `matches` `min.insync.replicas`.

**Grade.** As in the spec. This lab only stacks lab 05 and lab 07. It does not add a new kind of failure.

---

## What is not in these ten

Listeners, adding a broker, draining one, a rolling restart, ACLs, and quotas are shelf 2. They need a second network, a fourth broker, or an authorizer.

The session runtime that creates the pod, runs `setup.sh`, and runs `grade.sh` is not built yet. The pod shape it has to create is the trial in `deploy/eks/kafka/trial-kafka3.yaml`, with one broker omitted for labs 06–08, and a 64 Mi emptyDir on one broker for labs 05 and 09.
