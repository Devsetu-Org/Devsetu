# raftkv

A replicated key/value store built on Raft, in Go, built chapter by chapter.
Chapter 1 gave the cluster a leader. This chapter lets the leader replicate a log.

```
cmd/raftkv/main.go                 REPL over a 3-node cluster (given)
internal/labrpc/                   in-process RPC that drops, delays, duplicates (given)
internal/labharness/               cluster, partitions, crashes, safety checks (given)
internal/storage/                  where a node keeps durable state (given)
internal/raft/raft.go              the Raft struct, Make, the ticker (given)
internal/raft/rpc.go               wire types for the two RPCs (given)
internal/raft/election.go          chapter 1, solved
internal/raft/vote.go              chapter 1, solved
internal/raft/replication.go       AppendEntries, replicateTo, Start      <- TODO 2.1 - 2.4
internal/raft/commit.go            hooks the next chapter fills in (given)
internal/raft/election_test.go     chapter 1 tests (given)
internal/raft/replication_test.go  acceptance tests (given)
```

## Your work

| Task | Where | What |
| --- | --- | --- |
| 2.1 | `replication.go` `AppendEntries` | Refuse a log that does not line up; say where to retry from |
| 2.2 | `replication.go` `appendToLog` | Skip entries you have, cut the log only at a real conflict |
| 2.3 | `replication.go` `replicateTo` | Send from `nextIndex`, track `matchIndex`, back up on refusal |
| 2.4 | `replication.go` `Start` | The leader appends a command and starts replicating |

## Running

```
make test     # go test ./...
make race     # same, with the race detector
make run      # REPL: status | start <text> | log N | cut N | heal | quit
```

Nothing commits yet. `start hello` shows the entry on every node's log, with `commit 0`.
