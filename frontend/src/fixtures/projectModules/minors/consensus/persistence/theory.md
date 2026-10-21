## Where you are
<!-- mode: read-only -->

The cluster elects, replicates and commits, but everything lives in memory. Kill a node and it comes back blank. A blank node is dangerous, not just empty: it can vote twice in a term it already voted in, or forget entries it told a leader it had stored.

```plaintext
   ch 5      │   kv: Put / Get / Delete      │
   ch 4      │   persistence                 │ ◀──── you are here
   ch 3      │   commit + apply (solved)     │
   ch 2      │   log replication (solved)    │
   ch 1      │   election (solved)           │
```

> [!scope] This chapter's job
> Save the state Raft's safety depends on, load it on start, and make the save itself crash-proof. Nothing else changes: the code you wrote in chapters 1 and 2 already calls `persist()` at every right moment.

## What must survive
<!-- mode: read-only -->

### Three things, and why each

| State | If a node forgets it |
| --- | --- |
| `currentTerm` | The node could accept a stale leader's messages or vote in a term it already moved past. Terms must never go backwards. |
| `votedFor` | It could vote for two candidates in one term. Two leaders in a term, and two histories. |
| `log` | It could have told a leader "I stored entry 7", helped it reach a majority, and then lose entry 7. The leader's commit rests on a promise that was not kept. |

Everything else is **rebuilt**:

| State | How it comes back |
| --- | --- |
| `commitIndex`, `lastApplied` | Start at 0. The leader's `LeaderCommit` brings `commitIndex` back, and the apply loop replays the log into the state machine from index 1. |
| `nextIndex`, `matchIndex` | Reinitialised at every election. |
| the role | Always starts as a follower. |

### Persist before you reply

Every message a node sends is a statement about its state: "I vote for you", "I stored up to index 9". If the node crashes between sending the reply and saving the state, the other side acts on a promise the restarted node has no memory of.

```plaintext
  wrong:   votedFor = C  ──▶  reply "granted"  ──▶  persist()      crash here: C counts the vote, we forgot it
  right:   votedFor = C  ──▶  persist()  ──▶  reply "granted"       crash anywhere: either C has no vote, or we remember it
```

In the code you already wrote, handlers return after `persist()` and the reply is sent when they return, so the order is right.

## Saving and loading
<!-- mode: read-and-implement tasks:4.1,4.2 -->

### One blob

<!-- lang: go -->
A `storage.Store` holds one opaque byte slice: `Save(state)` replaces it, `Load()` returns it (or `nil` if nothing was ever saved). `persist` encodes the three fields into that blob; `readPersist` decodes it.

`persistentState` in `persist.go` is given. Use `encoding/gob`: encode it into a `bytes.Buffer` with `gob.NewEncoder(&buf).Encode(...)`, decode it with `gob.NewDecoder(bytes.NewReader(data)).Decode(&state)`. Add `bytes` and `encoding/gob` to the file's imports.

The log includes the index-0 sentinel; gob carries it like any other entry.
<!-- /lang -->

The simplest design rewrites the whole state on every change. That is O(log size) per save, which is fine for tests and wrong for production: real systems append to a log file and fsync, and occasionally snapshot (the end of chapter 5 lists what production adds). Keep the idea; skip the optimisation.

> [!tip] Fail loudly when the disk fails
> If `Save` returns an error the node cannot keep its promises. Do not log and continue: `panic`. A crashed node is safe; a node that keeps answering after a failed write is not.

<!-- lang: go -->
### `TODO(4.1)` — `persist`

In `internal/raft/persist.go`, with the lock held (callers hold it): gob-encode `persistentState{rf.currentTerm, rf.votedFor, rf.log}` and pass the bytes to `rf.store.Save`. Panic on an encode or save error.

### `TODO(4.2)` — `readPersist`

In the same file. `rf.store.Load()` returns `nil` on first boot: leave the fresh state alone. Otherwise decode into a `persistentState` and copy the three fields back. If the decoded log is empty, put the sentinel back with `[]LogEntry{{}}`. Do **not** touch `commitIndex` or `lastApplied`.

`Make` calls `readPersist` once, before any goroutine starts.
<!-- /lang -->

## Crash-safe files
<!-- mode: read-and-implement tasks:4.3,4.4 -->

### The save can crash too

<!-- lang: go -->
`storage.Mem` is what most tests use: it keeps the bytes in memory and survives because the harness holds on to it across a "crash". A real node needs a real file, `storage.File`. Overwriting a file in place is dangerous: if the power fails halfway you have half of the old state and half of the new, which can be a valid-looking nonsense (a `votedFor` from one version and a log from another).
<!-- /lang -->

The fix is the same one the LSM minor's manifest used: never modify the live file. Build the new one on the side, then swap it in with a single atomic step.

```plaintext
  write raft-state.tmp  →  fsync  →  rename raft-state.tmp → raft-state  →  fsync directory
```

| Crash during… | After restart |
| --- | --- |
| writing the temp file | `raft-state` is still the old state; a stray `.tmp` is ignored |
| the rename | the old state or the new state, never a mix (`rename` is atomic) |
| before the directory fsync | usually the new state; the rename might not have reached disk, in which case the old state, which is still consistent |

Each fsync matters. Without the first, the rename could reach the disk before the data does, leaving a complete-looking empty file. Without the directory fsync, the rename may not survive power loss, and a `Save` that returned success would be lost.

`Load` reads only the real file. A leftover `.tmp` means a `Save` was interrupted: the old file is still the truth, so ignore it.

<!-- lang: go -->
### `TODO(4.3)` — `Save`

In `internal/storage/file.go`. `tempPath()` and `finalPath()` are given.

1. `os.OpenFile(f.tempPath(), os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0o644)`.
2. `Write(state)`, `Sync()`, `Close()`. Close the file on every error path.
3. `os.Rename(f.tempPath(), f.finalPath())`.
4. `os.Open(f.dir)`, `Sync()` it, `Close()` it.

### `TODO(4.4)` — `Load`

`os.ReadFile(f.finalPath())`. If `errors.Is(err, os.ErrNotExist)`, return `nil, nil`: never saved. Any other error is returned. Add `errors` to the imports.
<!-- /lang -->

## What the tests do
<!-- mode: read-only -->

### Crashing at awkward moments

A "crash" in the harness stops the node, closes its network connections, and **fences its store**: any goroutine the dead node left behind can no longer write. The restarted node gets the same store, and nothing else.

| Test | What it proves |
| --- | --- |
| vote survives restart | A node that granted a vote, crashed, and came back refuses a second candidate in that term. |
| log survives full restart | Kill all three nodes, restart them: logs are intact, a leader emerges, state machines replay, and a new command gets the next index. |
| restarted leader catches up | The old leader's log is consistent with what committed while it was dead. |
| crash loop | Fourteen rounds of commands, crashes and restarts on a lossy network. The harness checks that every committed command is still committed at the same index at the end. |
| on disk | The same, through `storage.File`. |

<!-- lang: go -->
```bash
make test     # chapters 1-4, including crash/restart and the file store
make race     # the same tests with the race detector
make run      # a REPL over a 3-node cluster: start, crash N, restart N
```
<!-- /lang -->

```plaintext
> start a
> crash 0
> restart 0
> log 0
  1  term 1  a            ← the restarted node remembers
```

> [!check] Before you move on
> Say these out loud:
>
> 1. `currentTerm`, `votedFor` and the log are saved; commit and apply positions are rebuilt.
> 2. State is saved before the reply that depends on it leaves the node.
> 3. A failed save is a crash, not a log line.
> 4. A file is replaced atomically: write aside, fsync, rename, fsync the directory.
> 5. A restarted node replays its log into the state machine from index 1.
