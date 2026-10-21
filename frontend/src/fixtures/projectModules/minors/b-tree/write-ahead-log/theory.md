## Where you are
<!-- mode: read-only -->

Chapter 2 built a B+ tree over the pager. `Put` changes several pages: a leaf, maybe its parent, maybe a new root, and the header. Those are separate writes, and a crash can land between any two of them.

```plaintext
            Put / Get
                │
       ┌────────▼────────┐
  ch 2 │    B+ tree       │  done
       └────────┬────────┘
       ┌────────▼────────┐        ┌─────────────┐
  ch 3 │   Log + pages    │ ◀──────│ you are here │
       └──┬───────────┬──┘        └─────────────┘
          ▼           ▼
       wal.log      data.db
```

This chapter adds the **write-ahead log** (WAL): an append-only file that receives every change before any page does. On startup the log is replayed, and the page file comes out consistent.

> [!scope] This chapter's job
> Make every acknowledged `Put` survive a crash, and make a crash in the middle of a
> `Put` leave no trace. The log grows until `Close` checkpoints it; the buffer pool and
> delete come later.

## Why a log
<!-- mode: read-only -->

### Updating in place is dangerous

A B+ tree overwrites pages where they are. If the process dies halfway through a split, the file holds a mix of old and new pages: a leaf that lost half its keys and no parent that knows where they went. There is no "previous version" to fall back to, because the old page was overwritten.

A log fixes this with one rule:

**Log first, then change the pages, then acknowledge.** If the process dies after the log is durable, replay redoes the change. If it dies before, the change never happened, and since it was never acknowledged, nothing was promised.

```plaintext
  Put("order:7", "paid")
     │
     ├─ 1. run the tree in memory: new page images, new root, new header state
     ├─ 2. append them to wal.log, then a commit record   ← durable from here (with fsync)
     ├─ 3. write the page images into data.db              ← the page file catches up
     └─ 4. return OK
```

### Why the log is allowed to be slow to read and fast to write

The log is written strictly at its end: sequential I/O, one `fsync`. The page file is written at random places and does not even need an `fsync` per write, because the log can always recreate it. Postgres, InnoDB, SQLite (in WAL mode), and etcd all work this way.

### What goes in the log

This engine logs **full page images**: after a write, the complete new contents of every page it changed (Postgres does the same for the first change to a page after a checkpoint). That makes recovery trivial and safe to repeat:

- Replaying an image just overwrites a page with the right bytes. Doing it twice gives the same result, so a crash *during recovery* is fine too.
- It also repairs **torn pages**: a page half-written when the power failed is simply overwritten by the logged image.

The price is size: one `Put` logs a 4 KiB image for every page it touched. Real engines log smaller deltas; the lesson is the same.

| Record | Meaning |
| --- | --- |
| `KindPage` | the full contents of one page |
| `KindMeta` | the header state after the write: root, page count, freelist head |
| `KindCommit` | the batch is complete |

A write is a **batch**: page images, one meta record, then a commit. A batch without its commit record never happened.

<!-- lang: go -->
How a `Put` becomes a batch is given: `internal/db/txn.go` runs the tree over an in-memory overlay, so every `WritePage` the tree makes lands in memory only, and `txn.records()` turns the result into log records. `apply.go` writes records back into pages. You write the log itself and the two functions that connect it to the engine.
<!-- /lang -->

## The record format
<!-- mode: read-and-implement tasks:3.1 -->

### A crash can stop a write halfway

A log write is not atomic either. A crash can leave the last record half written. Replay has to tell "this is a whole record" from "this is the remains of one", so each record carries its own length and a **checksum**.

```plaintext
  ┌──────────────┬──────────────┬──────────────────────────────────────────┐
  │ crc32c  (4)  │ length  (4)  │ payload (length bytes)                    │
  └──────────────┴──────────────┴──────────────────────────────────────────┘
                                  kind (1) │ page (4) │ dataLen (uvarint) │ data
```

- **length** says how many payload bytes follow. If the file ends before that, the record was cut short.
- **crc32c** checksums the payload. If any byte is wrong, the checksum will not match.

It is the same framing as the page trailer from chapter 1, put in front instead of behind.

<!-- lang: go -->
### `TODO(3.1)` — `encode`

In `internal/wal/record.go`. `appendPayload` (given) writes the payload. Your job is the frame around it:

1. Remember `start := len(dst)`, then append `headerSize` zero bytes as a placeholder.
2. `dst = appendPayload(dst, r)`; the payload is `dst[start+headerSize:]`.
3. Write `crc32.Checksum(payload, crcTable)` into `dst[start:start+4]` and `len(payload)` into `dst[start+4:start+8]` with `binary.LittleEndian.PutUint32`.

`encode` **appends**: bytes already in `dst` must survive. The writer relies on that to put a whole batch into one buffer.
<!-- /lang -->

## Appending and fsync
<!-- mode: read-and-implement tasks:3.2 -->

### Write is not the same as durable

When `write()` returns, the bytes are in the **OS page cache**, not on the disk. A process crash keeps them. A power cut loses them. `fsync` asks the OS to push the file's data to the device and waits until it has.

| Mode | After `Append` returns, the batch survives | Cost |
| --- | --- | --- |
| `SyncAlways` | a process crash **and** a power cut | one fsync per batch |
| `SyncNever` | a process crash only | almost free |

Because a whole `Put` is one batch, it costs **one** fsync, however many pages it changed. Writing the batch in pieces would cost one per page and would leave a visible gap between the pieces.

> [!warn] One write per batch
> Build every record of the batch in memory and write them with **one** `Write` call.
> Do not wrap the file in a `bufio.Writer`: a buffered record is not in the file at all
> until the buffer flushes, so an acknowledged write could vanish with the process.

<!-- lang: go -->
### `TODO(3.2)` — `Append`

In `internal/wal/writer.go`:

1. `w.buf = w.buf[:0]`, then `w.buf = encode(w.buf, r)` for every record.
2. `n, err := w.f.Write(w.buf)`; add `n` to `w.size` even on error, then return the error if any.
3. If `w.mode == SyncAlways`, `return w.Sync()`.

`Sync` (given) calls `f.Sync` and records how much of the log is now durable. Chapter 4 asks the writer that question. `Create`, `OpenAppend`, `Size`, `Durable`, `Rewind`, `Reset`, and `Close` are given.
<!-- /lang -->

## Replay and the torn tail
<!-- mode: read-and-implement tasks:3.3 -->

### Read until the first bad record

Replay walks the file from offset 0. For each record it checks, in order:

```plaintext
  offset ─▶ ┌ header? ──── fewer than 8 bytes left ─────────▶ stop (torn tail)
            ├ length? ──── bigger than the bytes left ───────▶ stop (torn tail)
            ├ checksum? ── does not match the payload ───────▶ stop (torn tail)
            ├ payload? ─── does not decode ──────────────────▶ stop (torn tail)
            └ ok: hand the record to the caller, offset += 8 + length
```

The offset where replay stops is the **good** length of the log. Everything after it is a torn tail: the write that was in flight when the process died. It was never acknowledged, so dropping it is correct.

> [!idea] Why stop instead of skipping
> A bad record could also be a bit flip in the middle of an old, healthy log. Skipping it
> would silently lose one change and keep the rest, which could apply a page image on top
> of a missing one. Stopping loses everything after it. This engine always treats the
> first bad record as the end of the log, which is right for the common case: a crash
> during the last append.

Replay also hands the callback the **end offset** of each record. Recovery needs it for the next section.

<!-- lang: go -->
### `TODO(3.3)` — `scan`

In `internal/wal/reader.go`. `Replay` (given) reads the file and handles a missing one; `scan` walks the bytes. Loop over `data`:

1. `rest := data[good:]`. If `len(rest) < headerSize`, return `good, nil`.
2. Read `sum` from `rest[0:4]` and `n` from `rest[4:8]` (`binary.LittleEndian.Uint32`). If `n > maxRecordSize` or the payload would run past the end of `rest`, stop.
3. `payload := rest[headerSize : headerSize+n]`. If `crc32.Checksum(payload, crcTable) != sum`, stop.
4. `r, err := decodePayload(payload)`; if it fails, stop.
5. `end := good + headerSize + n`. Call `fn(r, end)`. If it returns an error, return `good, err`.
6. `good = end`.

"Stop" means `return good, nil`. You will need to import `encoding/binary` and `hash/crc32`.
<!-- /lang -->

## Recovery in the engine
<!-- mode: read-and-implement tasks:3.4 -->

### Only committed batches count

A good record is not a committed one. A crash can cut the log *between* two records of the same batch: both records are intact, but the commit never arrived. Applying the page images of such a batch could write half of a split.

```plaintext
  log:  [page 3][page 7][meta][COMMIT]  [page 3][page 9]  ← crash here
         └──── batch 1: apply ────────┘   └ batch 2: no commit, ignore
```

So recovery collects records into a **pending batch**, applies the batch when it sees `KindCommit`, and throws away whatever is pending at the end.

It must also cut the log at the **last commit**, not at the end of the last good record. Otherwise the leftover records of the unfinished batch stay in front of the next commit, and the next recovery would apply them together with a batch they do not belong to. One of the tests does exactly this.

```plaintext
  Open(dir)
    ├─ Replay(wal.log): collect records, apply each batch at its commit
    ├─ remember the end of the last commit
    ├─ truncate wal.log there          ← cut the unfinished batch and the torn tail
    └─ keep wal.log open for appends
```

### Commit: log first

`commit` is the other half. It runs after the tree has changed pages in memory (the `txn`), and it does the rule from the top of this chapter in order: append the whole batch, and only then write the pages. If the append fails, the partial batch is taken back with `Rewind`, so a write that failed never leaves records behind.

<!-- lang: go -->
### `TODO(3.4)` — `recoverLog` and `commit`

In `internal/db/recover.go`. `Open` and `update` in `db.go` are given and call these two:

- `recoverLog` (called by `Open`): `path := filepath.Join(d.dir, walName)`, then `wal.Replay(path, ...)` with a callback that appends each record to `pending`. On a `wal.KindCommit`: `d.apply(pending)` (given; return its error), empty `pending`, and remember `end` as the last commit offset. After Replay, `d.log, err = wal.OpenAppend(path, lastCommit, d.opts.Sync)`.
- `commit` (called by `update` with `d.mu` held): `recs := t.records()` (given), `start := d.log.Size()`, `d.log.Append(recs...)`. If that fails, `d.log.Rewind(start)` and return the error. Only after it succeeded, `return d.apply(recs)`.

You will need to import `path/filepath` and the `wal` package. Later chapters keep this file exactly as you leave it: the buffer pool slots in underneath `d.store`, and `apply` writes to whatever it is.

> [!scope] Locking
> One mutex covers building the batch, the log append, and the page writes, so batches
> reach the log in the same order they reach the pages. Readers take the read lock.
<!-- /lang -->

### Checkpoint on close

The log cannot grow forever. `Close` (given) **checkpoints**: it fsyncs the page file and its header, and only then empties the log. If the process dies between the two steps, the log is replayed over pages that already have those images, which is harmless.

## Prove it
<!-- mode: read-only -->

<!-- lang: go -->
```bash
make test     # every acceptance test
make race     # the same tests with the race detector
make run      # a REPL that keeps its data in ./data
```
<!-- /lang -->

Kill it and come back:

```plaintext
$ make run
> put order:1 paid
OK
> put order:2 pending
OK
^C
$ make run
btreekv: dir=data, 2 keys, height 1. Type 'help'.
> get order:1
"paid"
```

The tests go further. They stop using a DB without closing it, trash pages in `data.db` to imitate torn writes, append garbage to the log, add a batch with no commit record, and log a write without applying it. Each time, a fresh `Open` has to come back with exactly the committed data.

> [!check] Before you move on
> 1. Log first, then pages, then acknowledge. Never in another order.
> 2. A `Put` is one batch of page images; it is real only once its commit record is.
> 3. Replay stops at the first bad record, and recovery cuts the log at the last commit.
> 4. Replaying a page image twice is harmless, which is why a crash during recovery is fine.

### What is missing

Every `Get` and every page write goes straight to the file. A root-to-leaf walk reads the same top pages again and again, and each write hits the page file immediately. Chapter 4 adds a **buffer pool**: a fixed set of in-memory frames that caches hot pages, evicts cold ones, and writes dirty pages back only once the log that describes them is durable.
