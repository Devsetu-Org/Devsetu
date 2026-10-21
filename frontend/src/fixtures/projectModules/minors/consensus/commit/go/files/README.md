# raftkv

A replicated key/value store built on Raft, in Go, built chapter by chapter.
Chapters 1 and 2 gave the cluster a leader and a replicated log. This chapter decides which entries are safe.

```
cmd/raftkv/main.go                 REPL over a 3-node cluster (given)
internal/labrpc/                   in-process RPC that drops, delays, duplicates (given)
internal/labharness/               cluster, partitions, crashes, safety checks (given)
internal/raft/raft.go              the Raft struct, Make, the ticker (given)
internal/raft/election.go          chapter 1, solved
internal/raft/vote.go              chapter 1, solved
internal/raft/replication.go       chapter 2, solved
internal/raft/commit.go            commitIndex and the apply loop         <- TODO 3.1 - 3.3
internal/raft/*_test.go            chapters 1-2 tests, then commit_test.go (given)
```

`StateMachine` (in `raft.go`) is the interface committed commands are applied to. The test harness supplies one that records every apply and checks that every server applied the same thing at each index.

## Your work

| Task | Where | What |
| --- | --- | --- |
| 3.1 | `commit.go` `advanceCommit` | Leader: highest majority-replicated index of the current term |
| 3.2 | `commit.go` `followerAdvanceCommit` | Follower: `min(leaderCommit, last verified entry)` |
| 3.3 | `commit.go` `applyLoop` | Apply `lastApplied+1 .. commitIndex` in order, once, outside the lock |

## Running

```
make test     # go test ./...
make race     # same, with the race detector
make run      # REPL: status | start <text> | log N | cut N | heal | quit
```

`status` now shows `commit` and `applied` counts climbing after `start hello`.
