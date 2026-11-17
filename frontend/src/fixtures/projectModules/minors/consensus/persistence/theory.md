## Persistence
<!-- mode: read-only -->

The cluster elects, replicates and commits, but everything lives in memory. Kill a node and it comes back blank. A blank node is dangerous, not just empty: it can vote twice in a term it already voted in, or forget entries it told a leader it had stored. This chapter digs into the durable core.

![Raft stack chapter 4: persistence highlighted](/consensus/persistence/you-are-here.jpg)

> [!scope] This chapter's job
> Save the state Raft's safety depends on, load it on start, and make the save itself crash-proof. Nothing else changes: the code you wrote in chapters 1 and 2 already calls `persist()` at every right moment.

### What we are building

Three fields must survive a crash. Everything else is rebuilt from them (and from the live leader):

![currentTerm, votedFor, and log must survive; commitIndex, lastApplied, nextIndex, matchIndex, and role are rebuilt](/consensus/persistence/what-survives.jpg)

- Forget `currentTerm` → the node could accept a stale leader's messages or vote in a term it already moved past. Terms must never go backwards.
- Forget `votedFor` → it could vote for two candidates in one term. Two leaders in a term, and two histories.
- Forget `log` → it could have told a leader "I stored entry 7", helped it reach a majority, and then lose entry 7. The leader's commit rests on a promise that was not kept.

`commitIndex` and `lastApplied` start at 0 after restart. The leader's `LeaderCommit` brings `commitIndex` back, and the apply loop replays the log into the state machine from index 1. `nextIndex` / `matchIndex` are reinitialised at every election. The role always starts as a follower.

### Persist before you reply

Every message a node sends is a statement about its state: "I vote for you", "I stored up to index 9". If the node crashes between sending the reply and saving the state, the other side acts on a promise the restarted node has no memory of.

![Wrong: reply then persist. Right: persist then reply](/consensus/persistence/before-reply.jpg)

In the code you already wrote, handlers return after `persist()` and the reply is sent when they return, so the order is right.

> [!tip] Fail loudly when the disk fails
> If `Save` returns an error the node cannot keep its promises. Do not log and continue: panic / raise. A crashed node is safe; a node that keeps answering after a failed write is not.

## Saving and loading
<!-- mode: read-and-implement tasks:4.1,4.2 -->

### One blob

A `Store` holds one opaque byte slice: `Save(state)` replaces it, `Load()` returns it (or empty / `nil` if nothing was ever saved). `persist` encodes the three fields into that blob; `readPersist` decodes it.

The simplest design rewrites the whole state on every change. That is O(log size) per save, which is fine for tests and wrong for production: real systems append to a log file and fsync, and occasionally snapshot (the end of chapter 5 lists what production adds). Keep the idea; skip the optimisation.

> [!idea] Why rewrite the whole blob
> A single opaque `Save` means the store does not need to understand Raft. Atomicity is the store's job; schema is Raft's. When chapter 5 talks about incremental persistence, that is a faster store with the same contract — not a different safety story.

<!-- lang: go -->
`persistentState` in `persist.go` is given. Use `encoding/gob`: encode it into a `bytes.Buffer` with `gob.NewEncoder(&buf).Encode(...)`, decode it with `gob.NewDecoder(bytes.NewReader(data)).Decode(&state)`. Add `bytes` and `encoding/gob` to the file's imports.

The log includes the index-0 sentinel; gob carries it like any other entry.

### `TODO(4.1)` — `persist`

In `internal/raft/persist.go`, with the lock held (callers hold it): gob-encode `persistentState{rf.currentTerm, rf.votedFor, rf.log}` and pass the bytes to `rf.store.Save`. Panic on an encode or save error.

### `TODO(4.2)` — `readPersist`

In the same file. `rf.store.Load()` returns empty on first boot: leave the fresh state alone. Otherwise decode into a `persistentState` and copy the three fields back. If the decoded log is empty, put the sentinel back with `[]LogEntry{{}}`. Do **not** touch `commitIndex` or `lastApplied`.

`Make` calls `readPersist` once, before any goroutine starts.
<!-- /lang -->
<!-- lang: python -->
`PersistentState` in `persist.py` is given. Use `pickle`: `pickle.dumps(state, protocol=pickle.HIGHEST_PROTOCOL)` to encode, `pickle.loads(data)` to decode. The import is already there.

The log includes the index-0 sentinel; pickle carries it like any other entry.

### `TODO(4.1)` — `persist`

In `raftkv/raft/persist.py`, with the lock held (callers hold it): build `PersistentState(current_term=self.current_term, voted_for=self.voted_for, log=list(self.log))`, pickle it, and pass the bytes to `self.store.save`. Raise on failure — do not swallow it.

### `TODO(4.2)` — `read_persist`

In the same file. `self.store.load()` returns empty / `None` on first boot: leave the fresh state alone. Otherwise unpickle into a `PersistentState` and copy the three fields back. If the decoded log is empty, put the sentinel back with `[LogEntry()]`. Do **not** touch `commit_index` or `last_applied`.

`make` calls `read_persist` once, before any thread starts.
<!-- /lang -->
<!-- lang: cpp -->
There is no separate schema type: encode `current_term_`, `voted_for_`, and `log_` into one string (a simple `|`-separated framing is fine), and decode the same way on load. Call `store_->Save` / `store_->Load`.

The log includes the index-0 sentinel; your framing must carry it.

### `TODO(4.1)` — `Persist`

In `src/raft/persist.cc`, with the lock held (callers hold it): serialize the three fields and pass the bytes to `store_->Save`. Throw or abort on failure — do not continue as if the write succeeded.

### `TODO(4.2)` — `ReadPersist`

In the same file. `store_->Load()` returns empty on first boot: leave the fresh state alone. Otherwise decode and copy the three fields back. If the decoded log is empty, put the sentinel back. Do **not** touch `commit_index_` or `last_applied_`.

`Make` calls `ReadPersist` once, before any thread starts.
<!-- /lang -->

## Crash-safe files
<!-- mode: read-and-implement tasks:4.3,4.4 -->

### The save can crash too

`Mem` is what most tests use: it keeps the bytes in memory and survives because the harness holds on to it across a "crash". A real node needs a real file, `File`. Overwriting a file in place is dangerous: if the power fails halfway you have half of the old state and half of the new, which can be a valid-looking nonsense (a `votedFor` from one version and a log from another).

The fix is the same one the LSM minor's manifest used: never modify the live file. Build the new one on the side, then swap it in with a single atomic step.

![write temp → fsync → rename → fsync directory; crash mid-write keeps the old file](/consensus/persistence/atomic-rename.jpg)

- Crash while writing the temp file → `raft-state` is still the old state; a stray `.tmp` is ignored.
- Crash during the rename → the old state or the new state, never a mix (`rename` is atomic).
- Crash before the directory fsync → usually the new state; the rename might not have reached disk, in which case the old state, which is still consistent.

Each fsync matters. Without the first, the rename could reach the disk before the data does, leaving a complete-looking empty file. Without the directory fsync, the rename may not survive power loss, and a `Save` that returned success would be lost.

`Load` reads only the real file. A leftover `.tmp` means a `Save` was interrupted: the old file is still the truth, so ignore it.

> [!warn] Do not delete the temp after a failed write and "start over" into the live path
> The live file is the last known-good state. Touching it mid-failure is how you get a torn mix. Always write a fresh temp, then rename over the live name.

<!-- lang: go -->
### `TODO(4.3)` — `Save`

In `internal/storage/file.go`. `tempPath()` / `finalPath()` helpers (or `FileName` + `dir`) are given.

1. `os.OpenFile` the temp path with `O_WRONLY|O_CREATE|O_TRUNC`.
2. `Write(state)`, `Sync()`, `Close()`. Close the file on every error path.
3. `os.Rename` temp → final.
4. `os.Open` the directory, `Sync()` it, `Close()` it.

### `TODO(4.4)` — `Load`

`os.ReadFile` the final path. If `errors.Is(err, os.ErrNotExist)`, return `nil, nil`: never saved. Any other error is returned. Add `errors` to the imports.
<!-- /lang -->
<!-- lang: python -->
### `TODO(4.3)` — `save`

In `raftkv/storage/file.py`. `temp_path()` and `final_path()` are given.

1. Open the temp path for write (`"wb"`).
2. Write `state`, `flush()`, then `os.fsync` the file descriptor. Close on every path.
3. `os.replace(temp, final)` (atomic rename).
4. `os.open` the directory, `os.fsync` it, `os.close` it.

### `TODO(4.4)` — `load`

Read `final_path()` bytes. On `FileNotFoundError`, return `None`: never saved. Any other error propagates.
<!-- /lang -->
<!-- lang: cpp -->
### `TODO(4.3)` — `Save`

In `src/storage/file.cc`. `TempPath()` and `FinalPath()` are given.

1. Write `state` to the temp path (binary, truncate).
2. `fsync` the temp file (open it, `::fsync`, close).
3. `::rename` temp → final.
4. Open the directory, `::fsync` it, close it.

### `TODO(4.4)` — `Load`

Read the final path. If the file is missing, return an empty string: never saved. Otherwise return the bytes.
<!-- /lang -->

### What the tests do

A "crash" in the harness stops the node, closes its network connections, and **fences its store**: any worker the dead node left behind can no longer write. The restarted node gets the same store, and nothing else.

- **vote survives restart** — a node that granted a vote, crashed, and came back refuses a second candidate in that term.
- **log survives full restart** — kill all three nodes, restart them: logs are intact, a leader emerges, state machines replay, and a new command gets the next index.
- **restarted leader catches up** — the old leader's log is consistent with what committed while it was dead.
- **crash loop** — fourteen rounds of commands, crashes and restarts on a lossy network. Every committed command is still committed at the same index at the end.
- **on disk** — the same, through the file store.

<!-- lang: go -->
```bash
make test     # chapters 1-4, including crash/restart and the file store
make race     # the same tests with the race detector
make run      # a REPL over a 3-node cluster: start, crash N, restart N
```
<!-- /lang -->
<!-- lang: python -->
```bash
make test     # chapters 1-4, including crash/restart and the file store
make run      # a REPL over a 3-node cluster: start, crash N, restart N
```
<!-- /lang -->
<!-- lang: cpp -->
```bash
make test     # chapters 1-4, including crash/restart and the file store
make asan     # AddressSanitizer build of the same tests
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
> 1. `currentTerm`, `votedFor` and the log are saved; commit and apply positions are rebuilt.
> 2. State is saved before the reply that depends on it leaves the node.
> 3. A failed save is a crash, not a log line.
> 4. A file is replaced atomically: write aside, fsync, rename, fsync the directory.
> 5. A restarted node replays its log into the state machine from index 1.

Raft is durable. Chapter 5 puts a **key/value API** on top: Put / Get / Delete through the log, redirects to the leader, and exactly-once apply under client retries.
