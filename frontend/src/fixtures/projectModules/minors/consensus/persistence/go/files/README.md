# raftkv

A replicated key/value store built on Raft, in Go, built chapter by chapter.
Chapters 1 to 3 built a cluster that elects, replicates and commits, all in memory. This chapter makes it survive a crash.

```
cmd/raftkv/main.go                 REPL over a 3-node cluster (given)
internal/labrpc/                   in-process RPC that drops, delays, duplicates (given)
internal/labharness/               cluster, partitions, crashes, safety checks (given)
internal/storage/store.go          the Store interface (given)
internal/storage/mem.go            in-memory Store the harness keeps across a "crash" (given)
internal/storage/file.go           on-disk Store                          <- TODO 4.3, 4.4
internal/raft/persist.go           save and reload term, vote, log        <- TODO 4.1, 4.2
internal/raft/election.go          chapter 1, solved (already calls persist)
internal/raft/vote.go              chapter 1, solved (already calls persist)
internal/raft/replication.go       chapter 2, solved (already calls persist)
internal/raft/commit.go            chapter 3, solved
internal/raft/*_test.go            earlier chapters, then persistence_test.go (given)
internal/storage/file_test.go      acceptance tests for the file store (given)
```

## Your work

| Task | Where | What |
| --- | --- | --- |
| 4.1 | `persist.go` `persist` | Encode `currentTerm`, `votedFor`, `log` and save them |
| 4.2 | `persist.go` `readPersist` | Decode on start; leave `commitIndex` and `lastApplied` at 0 |
| 4.3 | `storage/file.go` `Save` | Temp file, fsync, rename, fsync the directory |
| 4.4 | `storage/file.go` `Load` | Read the final file; a missing file is an empty state |

## Running

```
make test     # go test ./...
make race     # same, with the race detector
make run      # REPL: status | start <text> | crash N | restart N | quit
```

In the REPL, `start a`, `crash 0`, `restart 0`, `log 0` is the whole chapter in four commands.
