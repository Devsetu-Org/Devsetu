# raftkv

A replicated key/value store built on Raft, in Go. Chapters 1 to 4 built a Raft that elects, replicates, commits and survives crashes. This chapter puts a key/value API on top.

```
cmd/raftkv/main.go                 REPL over a 5-server cluster (given)
internal/labrpc/                   in-process RPC that drops, delays, duplicates (given)
internal/labharness/               Raft-level cluster and safety checks (given)
internal/raft/                     chapters 1-4, solved
internal/storage/                  chapter 4, solved
internal/kv/op.go                  Op, and the request / reply wire types (given)
internal/kv/node.go                Server struct, StartServer, RPC routing (given)
internal/kv/cluster.go             StartCluster, partitions, crashes (given)
internal/kv/state.go               the map plus duplicate suppression      <- TODO 5.1
internal/kv/server.go              Apply and Execute                       <- TODO 5.2, 5.3
internal/kv/client.go              the Clerk: Put, Get, Delete             <- TODO 5.4
internal/kv/state_test.go          unit tests for State (given)
internal/kv/kv_test.go             end-to-end tests with partitions (given)
```

## Your work

| Task | Where | What |
| --- | --- | --- |
| 5.1 | `state.go` `State.Apply` | Get / Put / Delete, with each `(ClientID, Seq)` applied once |
| 5.2 | `server.go` `Apply` | Run the op, wake the request waiting at that log index |
| 5.3 | `server.go` `Execute` | `Start`, wait for the apply, notice lost leadership |
| 5.4 | `client.go` `do` | Retry the same request across servers, following redirects |

## Running

```
make test     # go test ./...
make race     # same, with the race detector
make run      # REPL: put k v | get k | del k | split 0,1 | crash N | restart N | heal | quit
```

Try it: `put a 1`, `leader`, `crash <that server>`, `get a`.
