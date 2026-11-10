# Consensus minor — authoring model

A chaptered minor: `constants/minors.ts` lists the chapters, and each `ready`
chapter has a fixture per language registered in `MINOR_CHAPTER_CONTENT`
(`fixtures/projectModules/index.ts`), keyed `minor/chapter/language`. The minor
stays `planned` (admin preview only) until enough chapters are authored to launch.

Languages: **Go, Python, and C++**. The learner picks a language inside a
chapter; it travels as `?lang=` and is remembered per minor.

## Chapters

| # | id | Status | Student focus | Author-owned (grows over time) |
| --- | --- | --- | --- | --- |
| 0 | `overview` | **ready** | reading only (`consensusOverview.ts`): why consensus, Raft, where it runs, the plan | keep the chapter table in sync with `minors.ts` |
| 1 | `election` | **ready** (go/python/cpp) | becomeFollower / logUpToDate / RequestVote / startElection / handleVoteReply + becomeLeader | `labrpc`, `labharness`, raft core (ticker, Make, timers), heartbeat-only replication, no-op commit / persist hooks, REPL |
| 2 | `replication` | **ready** (go/python/cpp) | AppendEntries consistency check, appendToLog, replicateTo, Start | `broadcastAppend`, RPC wire types |
| 3 | `commit` | **ready** (go/python/cpp) | advanceCommit, followerAdvanceCommit, applyLoop | StateMachine interface, harness apply recorder |
| 4 | `persistence` | **ready** (go/python/cpp) | persist / readPersist, atomic File Save / Load | Store interface, Mem, Fenced, persistentState type |
| 5 | `clients` | **ready** (go/python/cpp) | State.Apply (dedupe), Server.Apply + Execute, Clerk.do | kv.Op, Server struct + routing, StartCluster, REPL |
| 6 | `benchmark` | planned | hosted runner under a fixed fault schedule | placeholder until infra lands |

Chapters 1–5 are registered in `consensusChaptersGo.ts`,
`consensusChaptersPython.ts`, and `consensusChaptersCpp.ts`, which glob each
`<chapter>/<lang>/files/**` (never `solution/`).

### Task ids

| Chapter | Tasks |
| --- | --- |
| 1 | 1.1 `becomeFollower` · 1.2 `logUpToDate` · 1.3 `RequestVote` · 1.4 `startElection` · 1.5 `handleVoteReply` + `becomeLeader` |
| 2 | 2.1 `AppendEntries` · 2.2 `appendToLog` · 2.3 `replicateTo` · 2.4 `Start` |
| 3 | 3.1 `advanceCommit` · 3.2 `followerAdvanceCommit` · 3.3 `applyLoop` |
| 4 | 4.1 `persist` · 4.2 `readPersist` · 4.3 `File.Save` · 4.4 `File.Load` |
| 5 | 5.1 `State.Apply` · 5.2 `Server.Apply` · 5.3 `Server.Execute` · 5.4 `Clerk.do` |

Language-specific names follow snake_case (Python) or PascalCase (C++) in the
theory `<!-- lang: … -->` blocks; task ids are shared.

### Hook files (a path that is given early and owned later)

Raft's pieces call into each other across chapters, so three paths exist in
earlier starters as small working hooks and become task files in the chapter
that owns them. Carry-forward only looks at *earlier* chapters, so a hook never
overwrites a learner's work.

| Path (Go / Python / C++) | ch 1 | ch 2 | ch 3 | ch 4 | ch 5 |
| --- | --- | --- | --- | --- | --- |
| `raft/replication.{go,py,cc}` | heartbeat-only (given) | **tasks 2.x** | solved | solved | solved |
| `raft/commit.{go,py,cc}` | empty hooks (given) | empty hooks (given) | **tasks 3.x** | solved | solved |
| `raft/persist.{go,py,cc}` | no-op (given) | no-op (given) | no-op (given) | **tasks 4.1, 4.2** | solved |
| `storage/file.{go,py,cc}` | absent | absent | absent | **tasks 4.3, 4.4** | solved |
| `raft/vote` + `raft/election` | **tasks 1.x** | solved | solved | solved | solved |
| `kv/*` | absent | absent | absent | absent | state / server / client are **tasks 5.x** |

## Product name

The engine is **`raftkv`**: N nodes in one test process at first (deterministic
scheduler), later optional real TCP. Public client API:

```
Put(key, value) error
Delete(key) error
Get(key) (value, ok, err)
```

Cluster bootstrap is author-owned (`StartCluster(n)`). RPCs go through
`labrpc` so the fault injector can drop, delay, or duplicate messages without
sockets.

## Layout

```
<chapter>/
  theory.md
  go/files/            starter repo      go/solution/      edited files only
  python/files/        starter repo      python/solution/
  cpp/files/           starter repo      cpp/solution/
```

## Rules

Same as LSM / B-tree / query-engine minors: scratch repos per chapter,
`TODO(N.x)` markers, shared `theory.md` with `<!-- lang: go|python|cpp -->`
blocks, no hard wrapping, starters compile, `solution/` never globbed into the
bundle, learner-owned files stable across later chapters (carry-forward via
`utils/chapterCarry.ts`).

## Package layout (as built)

### Go

```
cmd/raftkv/           // REPL
internal/raft/        // election, log, commit (grows ch1-4)
internal/storage/     // Store, Mem, Fenced (given), File (ch4)
internal/kv/          // state machine, server, clerk (ch5)
internal/labrpc/      // given: unreliable in-process RPC
internal/labharness/  // given: partitions, crashes, safety monitor
```

Module path `github.com/devlabs/raftkv`, Go 1.22, standard library only.

### Python

```
raftkv/raft/          // election, log, commit (grows ch1-4)
raftkv/storage/       // Store, Mem, Fenced (given), File (ch4)
raftkv/kv/            // state machine, server, clerk (ch5)
raftkv/labrpc/        // given
raftkv/labharness/    // given
tests/                // unittest acceptance tests
```

Standard library only (`threading`, `pickle`, …).

### C++

```
cmd/raftkv/           // REPL
src/raft/             // election, log, commit (grows ch1-4)
src/storage/          // Store, Mem, Fenced (given), File (ch4)
src/kv/               // state machine, server, clerk (ch5)
src/labrpc/           // given
src/labharness/       // given
tests/                // acceptance tests
```

C++17, pthread, standard library only.

### Test inventory

Tests are cumulative: a chapter's starter ships its own tests plus every earlier chapter's.

| Chapter | Highlights |
| --- | --- |
| 1 | one leader, stable under heartbeats; re-election; minority cannot win; one leader per term under loss and delay; vote once per term; election restriction; step down on higher term |
| 2 | basic append; follower rejects Start; consistency check and ConflictIndex; stale RPC does not truncate; catch-up; divergent leader log replaced; lossy network |
| 3 | commit and apply in order; exactly-once under duplicates; no commit without a majority; old-term entry does not commit by counting (Figure 8); follower commit bounded by verified entries; uncommitted overwritten; committed survive leader changes |
| 4 | vote survives restart; term survives; full restart; restarted leader; crash loop on a lossy network; cluster on File store; atomic file replace |
| 5 | state dedupe; Put/Get/Delete; follower redirect hint; failover; minority leader cannot commit or serve reads; duplicate requests; concurrent clients on a lossy network; partitions and crashes under load; whole-cluster restart |

The harness monitor fails any test in which two nodes lead one term, two logs
violate Log Matching, or two servers apply different commands at one index.

## Design notes

- **Real time, not a deterministic scheduler.** Nodes run threads/goroutines on real
  timers (election 120-240 ms in tests, heartbeat 25 ms). `labrpc` randomness is
  seeded, but thread timing is not, so a failing run is not exactly repeatable.
- **No leader no-op.** `Start` is the only way entries arrive; a new leader commits
  inherited entries with the next command. The kv server makes `Get` a log entry, which
  also keeps reads linearizable. Chapter 3 theory explains why production systems append a no-op.
- **Whole-state persistence.** `persist()` rewrites term, vote and log every time.
  There are no snapshots or log compaction; the end of chapter 5 lists them as what production adds.
- **Clients sit outside partitions.** `labrpc.ExternalBase` ids reach every server that is up
  and not `Disconnect`ed, whichever partition it is in.
- **Starter panics / raises.** Starters panic/raise with `TODO(N.x)` in the task functions, except
  `persist` / `readPersist` (chapter 4), which are no-ops so earlier tests keep running.

## Invariants the tests enforce

- At most one leader per term (observable via harness).
- Committed entries are never overwritten and appear on every surviving majority.
- A minority partition cannot elect a leader that commits conflicting entries.
- After restart, persisted term / votedFor / log restore safety.

## Verifying a chapter

Go:

```bash
gofmt -l .
go vet ./...
go test -race -count=1 ./...
```

Python:

```bash
make test     # python3 -m unittest discover -s tests -v
make run
```

C++:

```bash
make test
make asan
make run
```

For each chapter: starter must compile with tests; overlaying
`<lang>/solution/` on `<lang>/files/` must pass `make test`. Later starters carry
earlier solutions byte-identical (check `diff` of each earlier task file against the earlier
`solution/` copy).
