## Where you are
<!-- mode: read-only -->

Chapter 3 made writes safe. It did not make them fast. Every `Get` reads each page of its root-to-leaf path from the file, every time, and every committed page is written to the file immediately.

```plaintext
            Put / Get
                │
       ┌────────▼────────┐
  ch 2 │    B+ tree       │
       └────────┬────────┘
       ┌────────▼────────┐        ┌─────────────┐
  ch 4 │   Buffer pool    │ ◀──────│ you are here │
       └──┬───────────┬──┘        └─────────────┘
          │           │ log first
          ▼           ▼
       data.db      wal.log
```

A B+ tree is built to be cached. The root is read by **every** lookup; the pages just under it by almost every lookup. Read them once and keep them in RAM, and a lookup in a three-level tree touches the disk for one page, not three.

> [!scope] This chapter's job
> A pool of frames between the tree and the page file: pin and unpin, clock eviction, and
> a write-back rule that never lets a page reach the file ahead of its log records. The
> tree itself does not change; it is handed the pool where it used to get the pager.

## Frames and pins
<!-- mode: read-and-implement tasks:4.1 -->

### A fixed number of frames

The pool owns a fixed array of **frames**, each holding one 4 KiB page. Memory use is exactly `frames × 4 KiB`, which is the point: a database that cached without limit would eat the machine.

```plaintext
   table (page no -> frame)                 frames
   ┌─────┬───────┐                   ┌─────────┬─────────┬─────────┬─────────┐
   │  1  │   0   │ ────────────────▶ │ page 1  │ page 9  │ page 4  │ (empty) │
   │  9  │   1   │                   │ pins 0  │ pins 2  │ pins 0  │         │
   │  4  │   2   │                   │ ref  1  │ ref  1  │ ref  0  │         │
   └─────┴───────┘                   │ dirty 0 │ dirty 1 │ dirty 0 │         │
                                     └─────────┴─────────┴─────────┴─────────┘
```

`Fetch(no)` returns the frame holding page `no`. A **hit** is a map lookup. A **miss** picks a frame to reuse, reads the page into it, and updates the map.

### Pinning keeps a page from moving

A caller that is using a frame's bytes must be sure the pool does not recycle the frame for another page in the middle. So `Fetch` **pins** the frame (a count, because several callers can use one page), and `Unpin` releases it. The pool never evicts a pinned frame. If every frame is pinned, `Fetch` fails with `ErrPoolFull`: it is the caller's job to unpin.

`Unpin(f, dirty)` also records whether the caller changed the page. A **dirty** frame is newer than the file, and must be written back before the frame is reused.

### The dirty page remembers the log

Chapter 3's rule still holds: the log records that describe a page must be durable before the page is written. The pool cannot know which log records those are, but it knows something close enough: how long the log was when the frame became dirty. That is the frame's **LSN** (log sequence number; here, just a byte offset). Every record describing the change ends at or before it.

```plaintext
   log:   [ ... batch A ... ][ ... batch B ... ]
                                              ▲ log.Size() = 9000  ← frame.lsn when B dirtied page 7
   log.Durable() = 6000  →  page 7 must NOT be written yet: record B might still be in the OS cache
```

<!-- lang: go -->
### `TODO(4.1)` — `pin` and `Unpin`

In `internal/buffer/pin.go`. The pool mutex is already held for you in both. `Fetch` and the `PageIO` methods in `pool.go` (given) call `pin`. `ReadPage` uses `load = true`; `WritePage` uses `load = false` because it overwrites the whole page and the page may not exist in the file yet (recovery writes pages the file never got).

`pin(no, load)`:

- **Hit** (`i, ok := p.table[no]`): `f := &p.frames[i]`, `f.pins++`, `f.ref = true`, return it.
- **Miss**: `i, err := p.victim()` (task 4.2). If the frame is in use, `p.flushFrame(f)` (task 4.3), then `delete(p.table, f.No)` and `f.used = false`. If `load`, `p.b.ReadPage(no, f.Data[:])`; on an error return it and leave the frame unused. Then claim it: `f.No = no`, `used`, `ref`, `pins = 1`, `dirty = false`, `lsn = 0`, and `p.table[no] = i`.

`Unpin(f, dirty)`:

- Panic if `f.pins == 0`: unpinning twice is a bug in the caller, and hiding it would let a frame be recycled under someone's feet.
- `f.pins--`. If `dirty`: `f.dirty = true` and `f.lsn = p.logSize()`.
<!-- /lang -->

## Choosing a victim
<!-- mode: read-and-implement tasks:4.2 -->

### Which page goes?

When the pool is full and a new page is needed, one resident page must leave. The ideal victim is the one that will be used furthest in the future. Nobody knows the future, so every policy guesses from the past.

| Policy | Idea | Cost |
| --- | --- | --- |
| LRU | evict the least recently used | a linked list updated on **every** access |
| FIFO | evict the oldest loaded | cheap, but evicts the root |
| **Clock** | approximate LRU with one bit per frame | one bit write on an access |

**Clock** arranges the frames in a circle with a **hand**. Each frame has a **ref bit**, set whenever the frame is used. To find a victim, the hand sweeps:

```plaintext
   frame:   A      B      C      D
   ref:     1      0      1      0
   pins:    0      0      1      0
            ▲
          hand

   A: ref=1 → clear it, second chance, move on
   B: ref=0, unpinned → VICTIM
```

A frame used since the last sweep survives one pass; a frame nobody touched is evicted. Postgres uses this exact scheme (with a counter instead of a single bit), and so did many Unix kernels.

Three details decide whether it works:

- A frame that was never used is free: take it at once.
- A pinned frame is skipped without touching its ref bit.
- A newly loaded frame starts with its ref bit **set**, so it is not evicted by the very next miss.

If every frame is pinned, a sweep finds nothing, and the pool reports `ErrPoolFull`. Two laps are enough to know: the first can clear every ref bit, the second must find an unpinned frame if one exists.

<!-- lang: go -->
### `TODO(4.2)` — `victim`

In `internal/buffer/evict.go`. The caller holds the mutex. Loop `step` from 0 to `2*len(p.frames)`: `i := p.hand`, advance `p.hand = (p.hand + 1) % len(p.frames)`, `f := &p.frames[i]`.

- `!f.used`: return `i`.
- `f.pins > 0`: skip.
- `f.ref`: clear it and skip.
- otherwise: return `i`.

After the loop return `0, ErrPoolFull`. The hand moves **past** the victim, so the next sweep starts after it. `TestClockGivesASecondChance` depends on that.
<!-- /lang -->

## Writing back, log first
<!-- mode: read-and-implement tasks:4.3 -->

### Eviction must not run ahead of the log

An evicted dirty page has to go to the file before its frame is reused. That is the moment the write-ahead rule matters: if the page reaches `data.db` while its log records are still in the OS cache, a power cut leaves the file with a change the log does not know about. Recovery cannot undo it, because this engine only redoes.

```plaintext
  flushFrame(f)
     ├─ f.dirty?                       no  ──▶ nothing to do
     ├─ f.lsn > log.Durable()?         yes ──▶ log.Sync()     ← the log catches up first
     ├─ backing.WritePage(f.No, f.Data)
     └─ f.dirty = false
```

With `SyncAlways`, the log is durable the moment `commit` returns, so the check always passes and costs nothing. With `SyncNever` the pool is the one that forces an `fsync`, just in time, and only when a dirty page is about to leave. That is how real systems can batch log flushes and still obey the rule.

> [!tip] Why not always sync
> A check against `Durable()` makes the common case free: after one `Sync`, many dirty
> pages with an older LSN go out without another one. `TestNoLogSyncWhenAlreadyDurable`
> fails an implementation that syncs every time.

<!-- lang: go -->
### `TODO(4.3)` — `flushFrame`

In `internal/buffer/flush.go`. The caller holds the mutex.

1. Return `nil` unless `f.dirty`.
2. If `p.log != nil && f.lsn > p.log.Durable()`, call `p.log.Sync()` and return its error if it fails.
3. `p.b.WritePage(f.No, f.Data[:])`; if that fails, return the error and leave `f.dirty` set.
4. Clear `f.dirty`.

`FlushAll` (given) calls this for every frame; `Close` uses it as part of the checkpoint.
<!-- /lang -->

## The pool under the tree
<!-- mode: read-only -->

### Nothing above changes

`Pool` implements the same interface the tree already uses: `ReadPage`, `WritePage`, `Allocate`, `Free`, and the header state. `db.go` (given) builds the pager, wraps it in a pool, and uses the pool as its `store`:

```plaintext
  tree ─▶ txn (chapter 3) ─▶ pool ─▶ pager ─▶ data.db
                              ▲
                              └── pool asks the log: is this page's LSN durable yet?
```

- **Reads** go through the pool, so hot pages (the root, the first internal level) are hits.
- **`apply`** (chapter 3, unchanged) writes page images with `WritePage`. They land **dirty in the pool**, not in the file. The log already holds them, so a crash that loses the pool loses nothing: recovery replays the log into a new pool.
- **`Close`** (given) flushes the pool, fsyncs the page file, and only then empties the log.

> [!warn] A free page may still be in the cache
> The pager pops the freelist by reading the head page from the file. A page freed a
> moment ago exists only as a dirty frame. `Pool.Allocate` (given) flushes that frame
> first. Without it the pager would read stale bytes and follow a pointer into nowhere.

### Cache sizing in the real world

The right pool size is "as much as you can spare": Postgres's `shared_buffers` (typically a quarter of RAM, the OS cache holds the rest), InnoDB's `innodb_buffer_pool_size` (often 70–80% of RAM on a dedicated server). The hit rate climbs steeply for the first few frames, which hold the top of the tree, then slowly.

## Prove it
<!-- mode: read-only -->

<!-- lang: go -->
```bash
make test     # every acceptance test
make race     # the same tests with the race detector
make run      # a REPL that keeps its data in ./data
```
<!-- /lang -->

`stats` shows the pool:

```plaintext
> stats
keys=5000 height=3 leaves=61 internal=3  pages=65 free=0  wal bytes=21139456  pool resident=65 dirty=65
```

The database tests use pools of 4 and 6 frames over thousands of keys, so nearly every operation evicts something. They check that results stay right, that a crash that throws the pool away loses nothing, and that with `SyncNever` the pool is what makes the log durable before a dirty page leaves.

> [!check] Before you move on
> 1. A pinned page is never evicted; an unpinned page may be at any time.
> 2. Clock approximates LRU with a ref bit per frame and a sweeping hand.
> 3. A dirty frame remembers the log size when it was dirtied, and the pool syncs the log up to that point before writing the page.
> 4. The tree did not change: the pool is just another page store.

### What is missing

You can insert and look up, and nothing ever leaves. `Delete` returns "not built yet", pages are never freed, and there is no way to list keys in order, even though the leaves are already linked. Chapter 5 finishes the engine: **delete** with borrow and merge to keep pages full, and **scan** along the leaf chain.
