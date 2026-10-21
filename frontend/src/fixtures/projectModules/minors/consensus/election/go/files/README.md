# raftkv

A replicated key/value store built on Raft, in Go, built chapter by chapter.
This repo starts with leader election: a cluster of nodes that agree on who is in charge.

```
cmd/raftkv/main.go                 REPL over a 3-node cluster (given)
internal/labrpc/                   in-process RPC that drops, delays, duplicates (given)
internal/labharness/               cluster, partitions, crashes, safety checks (given)
internal/storage/                  where a node keeps durable state (given)
internal/raft/raft.go              the Raft struct, Make, the ticker (given)
internal/raft/rpc.go               wire types for the two RPCs (given)
internal/raft/replication.go       heartbeats only for now (given, chapter 2 rewrites it)
internal/raft/election.go          terms, candidates, leaders           <- TODO 1.1, 1.4, 1.5
internal/raft/vote.go              RequestVote                          <- TODO 1.2, 1.3
internal/raft/election_test.go     acceptance tests (given)
```

## Your work

| Task | Where | What |
| --- | --- | --- |
| 1.1 | `election.go` `becomeFollower` | Adopt a newer term and forget the vote |
| 1.2 | `vote.go` `logUpToDate` | The election restriction: only vote for a log at least as good as yours |
| 1.3 | `vote.go` `RequestVote` | One vote per term; refuse stale terms |
| 1.4 | `election.go` `startElection` | New term, vote for yourself, ask everyone concurrently |
| 1.5 | `election.go` `handleVoteReply`, `becomeLeader` | Count fresh votes; take the job on a majority |

## Running

```
make test     # go test ./...
make race     # same, with the race detector
make run      # REPL: status | cut N | heal | crash N | restart N | quit
```

Try `make run`, then `status`, `cut 0` (cut the leader off), and `status` again a second later.
