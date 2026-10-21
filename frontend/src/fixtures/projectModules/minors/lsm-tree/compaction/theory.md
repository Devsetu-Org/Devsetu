## Where you are
<!-- mode: read-only -->

Every piece of the LSM tree works: writes are logged and buffered, flushes produce sorted tables, Bloom filters skip tables, and scans merge everything. One problem is left: nothing ever goes away.

```plaintext
        ┌─────────────────┐
  ch 1  │    Memtable      │
        └────────┬────────┘ flush
        ┌────────▼────────┐
  ch 3  │ 000009.sst       │  ┐
        │ 000008.sst       │  │  ch 5: you are here
        │ ...              │  ├─ merge ──▶ 000010.sst
        │ 000001.sst       │  ┘
        └─────────────────┘
```

> [!scope] This chapter's job
> Merge tables into one, dropping overwritten values and spent tombstones, and make
> the swap crash-safe with a manifest. This is the last chapter of the minor.

## Why compaction
<!-- mode: read-only -->

### Three costs that only grow

Write the same 300 keys ten times and flush after each round. The store now holds ten tables and 3,000 entries, and only 300 of them matter.

| Cost | Without compaction |
| --- | --- |
| **Space** | Every overwritten value and every tombstone stays on disk forever. |
| **Reads** | A lookup can check every table; a scan merges every table. Filters help point lookups, not scans. |
| **Startup** | Every table must be opened and its index and filter loaded. |

Compaction reads several tables, merges them (newest version wins, exactly like chapter 4's merging iterator), writes one new table, and deletes the inputs.

### The amplification triangle

Every LSM design trades three numbers:

| Amplification | Meaning | Compaction's effect |
| --- | --- | --- |
| **Write** | bytes written to disk / bytes the user wrote | goes **up**: data is rewritten each time it is compacted |
| **Read** | disk reads per lookup | goes **down**: fewer tables to check |
| **Space** | bytes on disk / bytes of live data | goes **down**: dead versions are dropped |

Compacting more often makes reads and space better and writes worse. RocksDB's leveled compaction favors reads and space; Cassandra's size-tiered compaction favors writes. This engine uses the simplest policy: when the number of tables reaches a trigger (default 4), merge them all into one. The REPL's `stats` shows the write amplification it costs.

## Merging and tombstones
<!-- mode: read-and-implement tasks:5.1 -->

### When can a tombstone go?

A tombstone exists to hide older values. In the merge output it is still needed **if any table older than the inputs might hold the key**. If the merge includes the oldest table, nothing older exists, and the tombstone can be dropped along with every value it hid.

```plaintext
  tables, newest first:   T3 [order:1=⊗]   T2 [order:2=paid]   T1 [order:1=pending]

  merge T3 + T2 only:     output [order:1=⊗, order:2=paid]   T1 [order:1=pending]
                          ✔ tombstone kept: T1 still holds order:1

  merge T3 + T2 + T1:     output [order:2=paid]
                          ✔ tombstone and the value it hid are both gone
```

> [!warn] Drop a tombstone too early and deleted data comes back
> If the first merge above had dropped the tombstone, the next `Get("order:1")` would miss the output, reach T1, and return `pending`. This is the classic LSM bug ("zombie" or "resurrected" data), and it has shipped in real databases. Cassandra's `gc_grace_seconds` exists because the same rule has to hold across replicas.

<!-- lang: go -->
### `TODO(5.1)` — `Merge`

In `internal/compaction/compaction.go`:

1. `m := iterator.NewMerging(inputs...)`. The merging iterator already returns one entry per key, the newest.
2. Walk it from `SeekToFirst`. If the entry is a tombstone and `dropTombstones` is set, count it in `st.DroppedTombstones` and skip it.
3. Otherwise `w.Add(m.Kind(), m.Key(), m.Value())`, return its error if any, and count `st.Written`.

You will need to import the `memtable` package for `KindTombstone`. The caller decides `dropTombstones` and calls `Finish`.
<!-- /lang -->

## The manifest
<!-- mode: read-and-implement tasks:5.2 -->

### Which files are live?

Until now, `Open` treated every `NNNNNN.sst` in the directory as live and used file numbers to tell newer from older. Compaction breaks both assumptions:

- A compaction writes its output **before** deleting its inputs, and deletes them one by one. A crash halfway through can leave an input holding `order:1=pending` while the input that held its tombstone is already gone. Treat every file as live and the deleted value is back.
- The output gets a **new, higher** number, but it holds data **older** than any table that was not part of the merge. File numbers no longer mean age.

The fix is a **manifest**: one small file that names the live tables, in newest-first order. A table not named in it is garbage, whatever is on disk.

```plaintext
  MANIFEST
  ─────────────────
  lsmkv-manifest v1
  next 12
  table 11          ← newest data
  table 10
  table 7           ← a compaction output: higher number than 6, older data than 10
```

### Atomic replace

The manifest must never be half written: if it is, the engine does not know what its own data is. The pattern is the same one flush used for tables:

```plaintext
  write MANIFEST.tmp  →  fsync  →  rename MANIFEST.tmp → MANIFEST  →  fsync dir
```

`rename` replaces the old manifest in one step. A crash leaves either the old manifest or the new one, plus possibly a stray `.tmp` that `Open` deletes.

> [!idea] Real manifests are logs
> LevelDB and RocksDB append "version edits" (add table 12, remove tables 7 and 9) to a manifest log instead of rewriting it, for the same reason the WAL is a log: appends are cheap. Rewriting a few lines is fine at this scale.

<!-- lang: go -->
### `TODO(5.2)` — `Save`

In `internal/manifest/manifest.go`. `encode(s)` (given) produces the text; `tmp` is given.

1. `os.OpenFile(tmp, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o644)`.
2. Write `encode(s)`, then `f.Sync()`, then `f.Close()`. Close the file on every error path.
3. `os.Rename(tmp, filepath.Join(dir, FileName))`.
4. `syncDir(dir)` (given), so the rename itself survives a power cut.

Flushes call `Save` now too, which is why this comes before 5.3. Your chapter 3 `flush` is unchanged: it hands each new table to `d.addTable`, and the given `addTable` in `db.go` now commits it in the manifest before making it live.
<!-- /lang -->

## Swapping tables safely
<!-- mode: read-and-implement tasks:5.3 -->

### The commit point

A compaction is a sequence of steps, and exactly one of them makes it real: saving the manifest.

```plaintext
  1. merge inputs → NNNNNN.sst.tmp, fsync     inputs still live
  2. rename → NNNNNN.sst, fsync dir           output exists, not live
  3. save manifest naming output, not inputs  ◀── commit point
  4. close and delete input files             cleanup
```

| Crash after step | On restart |
| --- | --- |
| 1 | `.tmp` deleted. Old manifest, old tables. As if nothing happened. |
| 2 | Output is an orphan (not in the manifest) and is deleted. As if nothing happened. |
| 3 | New manifest. Inputs are orphans and are deleted. Compaction complete. |
| 4 | Same as 3. |

`Open` (given) does that cleanup: it opens only the manifest's tables and deletes every other table and temp file.

### The output keeps its place

The output replaces its inputs **at their position** in the newest-first list. If the inputs were tables 2 and 3 of 4, the output goes between table 1 and table 4. Putting it first would let old values shadow newer ones.

<!-- lang: go -->
### `TODO(5.3)` — `compactRange`

In `internal/db/compact.go`. `inputs := d.tables[lo:hi]`, the new table number, `path`, and `tmp` are given.

1. Make a `*sstable.Iterator` per input (`in.t.NewIterator()`), keeping them in a slice and also passing them as `[]iterator.Iterator`. `w, err := sstable.Create(tmp, d.writerOptions())`. Call `compaction.Merge(children, w, hi == len(d.tables))`. If it fails, or any input iterator's `Err()` is non-nil, `w.Abort()` and return.
2. `w.Finish()`, `os.Rename(tmp, path)`, `syncDir(d.dir)`, then `t, err := sstable.Open(path)`. The output is `table{num: num, t: t, size: fileSize(path)}`.
3. `tables := d.tables[:lo]` + output + `d.tables[hi:]`, built in a **new** slice (appending to `d.tables[:lo]` would overwrite the inputs you still need). `d.saveManifest(tables)`; on error, close `t` and return.
4. `d.tables = tables`. Close each input's table and `os.Remove(tablePath(d.dir, in.num))`. `d.compactions++` and `d.compactedBytes += out.size`.

You will need to import `os` and the `compaction`, `iterator`, and `sstable` packages. `Compact` and the automatic trigger in `write` both call `compactRange(0, len(d.tables))`; one test calls it on a partial range to check the tombstone rule.
<!-- /lang -->

## Prove it
<!-- mode: read-only -->

<!-- lang: go -->
```bash
make test     # every acceptance test
make race     # the same tests with the race detector
make run      # REPL with compact and write amplification in stats
```
<!-- /lang -->

```plaintext
> put order:1 pending
> put order:2 pending
> flush
> put order:1 paid
> del order:2
> flush
> stats
memtable entries=0 bytes=0  wal bytes=0
tables=2 bytes=200  compactions=0
since open: flushed=200 compacted=0  write amplification=1.00
> compact
OK
> stats
memtable entries=0 bytes=0  wal bytes=0
tables=1 bytes=85  compactions=1
since open: flushed=200 compacted=85  write amplification=1.43
> scan
order:1  "paid"
```

(Each write and flush prints `OK`; left out here.)

Look at `data/`: one table, a `MANIFEST` naming it, and the log. `order:2`'s tombstone and both `pending` values are gone for good.

> [!check] You built an LSM tree
> 1. Writes go to a log and a skiplist, then flush to sorted, immutable tables.
> 2. Reads go newest first; Bloom filters skip tables, a heap merges them for scans.
> 3. Compaction rewrites tables to reclaim space and cut read cost, at the price of write amplification.
> 4. A tombstone may be dropped only when nothing older can hold its key.
> 5. A manifest, swapped by atomic rename, is the single source of truth for which files are live.

### Where to go from here

The same skeleton runs RocksDB, Cassandra, and ScyllaDB. What they add: leveled compaction (tables per level with non-overlapping key ranges, so a compaction touches a few files instead of all), background flush and compaction threads, block compression and caching, snapshots via sequence numbers, and a WAL with group commit.
