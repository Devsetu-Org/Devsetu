# Consensus minor — authoring model

A chaptered minor: `constants/minors.ts` lists the chapters, and each `ready`
chapter has a fixture per language registered in `MINOR_CHAPTER_CONTENT`
(`fixtures/projectModules/index.ts`), keyed `minor/chapter/language`. The minor
stays `planned` (admin preview only) until enough chapters are authored to launch.

Languages start with Go only. The learner picks a language inside a chapter; it
travels as `?lang=` and is remembered per minor.

## Chapters

| # | id | Status | Student focus | Author-owned (grows over time) |
| --- | --- | --- | --- | --- |
| 0 | `overview` | **ready** | reading only (`consensusOverview.ts`): why consensus, Raft, where it runs, the plan | keep the chapter table in sync with `minors.ts` |
| 1 | `election` | **ready** (go) | `becomeFollower`, `logUpToDate`, `RequestVote`, `startElection`, `handleVoteReply` + `becomeLeader` (`raft/election.go`, `raft/vote.go`) | `labrpc`, `labharness`, `raft.go` (ticker, `Make`, timers), heartbeat-only `replication.go`, no-op `commit.go` / `persist.go` hooks, REPL |
| 2 | `replication` | **ready** (go) | `AppendEntries` consistency check, `appendToLog`, `replicateTo`, `Start` (`raft/replication.go`) | `broadcastAppend`, `rpc.go` wire types |
| 3 | `commit` | **ready** (go) | `advanceCommit`, `followerAdvanceCommit`, `applyLoop` (`raft/commit.go`) | `StateMachine` interface, harness apply recorder |
| 4 | `persistence` | **ready** (go) | `persist` / `readPersist` (`raft/persist.go`), atomic `File.Save` / `Load` (`storage/file.go`) | `Store` interface, `Mem`, `Fenced`, `persistentState` type |
| 5 | `clients` | **ready** (go) | `State.Apply` (dedupe), `Server.Apply` + `Execute`, `Clerk.do` (`kv/state.go`, `kv/server.go`, `kv/client.go`) | `kv.Op`, `Server` struct + routing, `StartCluster`, REPL |
| 6 | `benchmark` | planned | hosted runner under a fixed fault schedule | placeholder until infra lands |

Chapters 1–5 are registered in `consensusChaptersGo.ts`, which globs each
`<chapter>/go/files/**` (never `solution/`).

### Task ids

| Chapter | Tasks |
| --- | --- |
| 1 | 1.1 `becomeFollower` · 1.2 `logUpToDate` · 1.3 `RequestVote` · 1.4 `startElection` · 1.5 `handleVoteReply` + `becomeLeader` |
| 2 | 2.1 `AppendEntries` · 2.2 `appendToLog` · 2.3 `replicateTo` · 2.4 `Start` |
| 3 | 3.1 `advanceCommit` · 3.2 `followerAdvanceCommit` · 3.3 `applyLoop` |
| 4 | 4.1 `persist` · 4.2 `readPersist` · 4.3 `File.Save` · 4.4 `File.Load` |
| 5 | 5.1 `State.Apply` · 5.2 `Server.Apply` · 5.3 `Server.Execute` · 5.4 `Clerk.do` |

### Hook files (a path that is given early and owned later)

Raft's pieces call into each other across chapters, so three paths exist in
earlier starters as small working hooks and become task files in the chapter
that owns them. Carry-forward only looks at *earlier* chapters, so a hook never
overwrites a learner's work.

| Path | ch 1 | ch 2 | ch 3 | ch 4 | ch 5 |
| --- | --- | --- | --- | --- | --- |
| `raft/replication.go` | heartbeat-only (given) | **tasks 2.x** | solved | solved | solved |
| `raft/commit.go` | empty hooks (given) | empty hooks (given) | **tasks 3.x** | solved | solved |
| `raft/persist.go` | no-op (given) | no-op (given) | no-op (given) | **tasks 4.1, 4.2** | solved |
| `storage/file.go` | absent | absent | absent | **tasks 4.3, 4.4** | solved |
| `raft/vote.go`, `raft/election.go` | **tasks 1.x** | solved | solved | solved | solved |
| `kv/*` | absent | absent | absent | absent | state / server / client are **tasks 5.x** |

Chapter 1's solved `becomeFollower`, `RequestVote`, `startElection` already call
`rf.persist()` and chapter 2's `AppendEntries` / `Start` already call
`rf.followerAdvanceCommit` and `rf.advanceCommit`. Those calls are no-ops until the
owning chapter lands, and the theory says so. Do not change a task file's
signatures in a later chapter.

## Product name

The engine is **`raftkv`**: N nodes in one test process at first (deterministic
scheduler), later optional real TCP. Public client API:

```go
Put(key, value []byte) error
Delete(key []byte) error
Get(key []byte) (value []byte, ok bool, err error)
```

Cluster bootstrap is author-owned (`StartCluster(n)`). RPCs are Go interfaces so
the fault injector can drop, delay, or duplicate messages without sockets.

## Layout

```
<chapter>/
  theory.md
  go/files/            starter repo      go/solution/      edited files only
```

## Rules

Same as LSM / B-tree minors: scratch repos per chapter, `TODO(N.x)` markers,
shared `theory.md` with `<!-- lang: go -->` blocks, no hard wrapping, starters
compile, `solution/` never globbed into the bundle, learner-owned files stable
across later chapters (carry-forward via `utils/chapterCarry.ts`).

## Go package layout (as built)

```
cmd/raftkv/           // REPL: raft cluster (ch1-4), kv cluster (ch5)
internal/raft/        // election, log, commit (grows ch1-4)
internal/storage/     // Store, Mem, Fenced (given), File (ch4)
internal/kv/          // state machine, server, clerk (ch5)
internal/labrpc/      // given: unreliable in-process RPC (gob on the wire)
internal/labharness/  // given: partitions, crashes, safety monitor
```

Module path `github.com/devlabs/raftkv`, Go 1.22, standard library only.

### Test inventory

Tests are cumulative: a chapter's starter ships its own tests plus every earlier chapter's.

| Chapter | File | Highlights |
| --- | --- | --- |
| 1 | `raft/election_test.go` | one leader, stable under heartbeats; re-election; minority cannot win; one leader per term under loss and delay; vote once per term; election restriction; step down on higher term |
| 2 | `raft/replication_test.go` | basic append; follower rejects `Start`; consistency check and `ConflictIndex`; stale RPC does not truncate; catch-up; divergent leader log replaced; lossy network |
| 3 | `raft/commit_test.go` | commit and apply in order; exactly-once under duplicates; no commit without a majority; old-term entry does not commit by counting (Figure 8); follower commit bounded by verified entries; uncommitted overwritten; committed survive leader changes |
| 4 | `raft/persistence_test.go`, `storage/file_test.go` | vote survives restart; term survives; full restart; restarted leader; crash loop on a lossy network; cluster on `storage.File`; atomic file replace |
| 5 | `kv/state_test.go`, `kv/kv_test.go` | state dedupe; Put/Get/Delete; follower redirect hint; failover; minority leader cannot commit or serve reads; duplicate requests; concurrent clients on a lossy network; partitions and crashes under load; whole-cluster restart |

The harness monitor fails any test in which two nodes lead one term, two logs
violate Log Matching, or two servers apply different commands at one index.

## Design notes

- **Real time, not a deterministic scheduler.** Nodes run goroutines on real
  timers (election 120-240 ms in tests, heartbeat 25 ms). `labrpc` randomness is
  seeded, but goroutine timing is not, so a failing run is not exactly repeatable.
- **No leader no-op.** `Start` is the only way entries arrive; a new leader commits
  inherited entries with the next command. The kv server makes `Get` a log entry, which
  also keeps reads linearizable. Chapter 3 theory explains why production systems append a no-op.
- **Whole-state persistence.** `persist()` rewrites term, vote and log every time.
  There are no snapshots or log compaction; the end of chapter 5 lists them as what production adds.
- **Clients sit outside partitions.** `labrpc.ExternalBase` ids reach every server that is up
  and not `Disconnect`ed, whichever partition it is in.
- **Starter panics.** Starters panic with `TODO(N.x)` in the task functions, except
  `persist` / `readPersist` (chapter 4), which are no-ops so earlier tests keep running.

## Invariants the tests enforce

- At most one leader per term (observable via harness).
- Committed entries are never overwritten and appear on every surviving majority.
- A minority partition cannot elect a leader that commits conflicting entries.
- After restart, persisted term / votedFor / log restore safety.

## Verifying a chapter

```bash
gofmt -l .
go vet ./...
go test -race -count=1 ./...
```

For each chapter: starter must be `gofmt`/`go vet` clean and compile with tests; overlaying
`go/solution/` on `go/files/` must pass `go test -race -count=1 ./...`. Later starters carry
earlier solutions byte-identical (check `diff` of each earlier task file against the earlier
`solution/` copy).
