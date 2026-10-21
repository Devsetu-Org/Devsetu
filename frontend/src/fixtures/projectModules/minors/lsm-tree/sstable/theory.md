## Where you are
<!-- mode: read-only -->

Chapter 2 made writes durable, at a price: the log only grows, every key lives in RAM forever, and startup replays the entire history. This chapter moves data out of memory and onto disk.

```plaintext
            Put / Delete                         Get
                 │                                │
        ┌────────▼────────┐                       │
  ch 2  │  Write-ahead log │  done                 │
        └────────┬────────┘                       │
        ┌────────▼────────┐                       │
  ch 1  │    Memtable      │  done ◀───────────────┤
        └────────┬────────┘                       │
                 │ full → flush                   │
        ┌────────▼────────┐                       │
  ch 3  │ SSTable SSTable  │ ◀──── you are here ◀──┘
        └─────────────────┘
```

When the memtable reaches a size limit, it is written to disk as an **SSTable** (sorted string table): one file, keys in order, never modified again. Then the log is started fresh, because the table now holds everything the log did.

> [!scope] This chapter's job
> Write and read SSTables, and flush the memtable into them. Lookups check tables
> newest first with a simple loop (given). Chapter 4 makes that fast with Bloom
> filters, and chapter 5 merges the tables that pile up.

## What an SSTable is
<!-- mode: read-only -->

### Sorted, immutable, self-describing

- **Sorted**: keys are written in increasing order, which is exactly the order the memtable iterator from chapter 1 produces.
- **Immutable**: once written, a table is never changed. Newer data goes into newer tables. That makes tables safe to read without locks, cache, copy, and back up.
- **Self-describing**: an index and a footer at the end let a reader find any key without scanning the file.

### The layout

```plaintext
  ┌─────────────────┐ offset 0
  │  data block 0    │  entries, sorted        ┐
  ├─────────────────┤                          │ each block is followed by
  │  data block 1    │                          │ a 4-byte CRC-32C trailer
  ├─────────────────┤                          │
  │  ...             │                          ┘
  ├─────────────────┤
  │  filter block    │  Bloom filter (chapter 4; empty for now)
  ├─────────────────┤
  │  index block     │  for each data block: its last key + where it is
  ├─────────────────┤
  │  footer (40 B)   │  where the filter and index are + magic number
  └─────────────────┘ end of file
```

A reader starts at the **end**: the footer has a fixed size, so it is always the last 40 bytes. The footer points at the index, the index points at the data blocks.

| Piece | Encoding |
| --- | --- |
| entry | `kind u8 · uvarint keyLen · key · uvarint valueLen · value` |
| index entry | `uvarint keyLen · lastKey · uvarint offset · uvarint length` |
| footer | `filterOff u64 · filterLen u64 · indexOff u64 · indexLen u64 · magic u64` |

`format.go` (given) encodes and decodes all three. Your job is the structure: which bytes go where, and how a reader uses them.

> [!tip] Tombstones go to disk too
> A flushed tombstone still has to hide older values in older tables. So the table keeps entries of both kinds, exactly like the memtable did.

## Writing a table
<!-- mode: read-and-implement tasks:3.1,3.2 -->

### Why blocks

You could write one long run of entries and index every key. The index would be as big as the data. Instead, entries are grouped into **blocks** of about 4 KiB, the size of a disk page, and the index holds one entry per block: the block's **last key** and its position.

```plaintext
  index:   [ "order:0099" → block 0 ] [ "order:0199" → block 1 ] [ "order:0299" → block 2 ]

  Get("order:0150"): first block whose last key >= "order:0150" is block 1
                     → read 4 KiB, scan it, done
```

A 64 MiB table has about 16,000 blocks, so its index is a few hundred KiB and fits in memory. Every lookup then costs **one** block read.

> [!idea] Real engines go further
> LevelDB and RocksDB compress each block, store keys with a shared-prefix encoding ("order:0150" after "order:0149" stores only "50"), and binary-search inside a block with restart points. Same structure, fewer bytes.

<!-- lang: go -->
### `TODO(3.1)` — `add` and `flushBlock`

In `internal/sstable/build.go`. The public `Add` and `Finish` in `writer.go` are given and call your functions; chapter 4 hooks the Bloom filter into them without touching this file.

- `add(kind, key, value)`: if this is not the first entry and `key <= w.lastKey`, return `ErrOutOfOrder`. Append the entry to `w.block` with `appendEntry`. Copy the key into `w.lastKey` (`append(w.lastKey[:0], key...)`; the caller may reuse its slice). Count it in `w.entries`. When `len(w.block) >= w.opts.BlockSize`, call `flushBlock`.
- `flushBlock`: return early for an empty block. Otherwise `h, err := w.writeBlock(w.block)` (given: writes the block and its CRC trailer, returns where it went), then `w.index = appendIndexEntry(w.index, w.lastKey, h)`, then `w.block = w.block[:0]`.

### `TODO(3.2)` — `finish`

The given `Finish` has already written the last, partly filled block (with your `flushBlock`) and the filter block. It passes the filter's handle in; this chapter that is the zero `handle{}`, meaning "no filter".

1. `index, err := w.writeBlock(w.index)`.
2. Write `encodeFooter(filter, index)` to `w.out`.
3. `w.out.Flush()`, `w.f.Sync()`, `w.f.Close()`. A table is only usable once all of it is on disk.

You will need to import `bytes` for `add`.
<!-- /lang -->

## Reading a table
<!-- mode: read-and-implement tasks:3.3 -->

### Open once, look up many times

Opening a table reads two things and keeps them in memory: the footer and the index. Data blocks stay on disk until a lookup asks for one.

```plaintext
  Open:  ReadAt(size-40, 40)  → footer → index handle
         ReadAt(index handle) → check CRC → decode index entries

  Get(k): binary search the index for the first block with lastKey >= k
          none?  → Missing (k is past the last key)
          ReadAt(that block) → check CRC → scan entries
              equal key, value      → Found
              equal key, tombstone  → Deleted
              greater key / end     → Missing
```

Every block read checks its CRC trailer, so a damaged file gives an error instead of wrong data.

<!-- lang: go -->
### `TODO(3.3)` — `open` and `get`

In `internal/sstable/lookup.go`. The public `Open` and `Get` in `reader.go` are given and call these two.

- `open`: read the footer with `f.ReadAt(footer, t.size-footerSize)`, then `decodeFooter` (it checks the magic number). `t.readBlock(indexHandle)` reads the index and checks its CRC; `decodeIndex` turns it into `t.index`. Return `t` and the filter handle from the footer: `Open` hands it to the filter loader, which does nothing until chapter 4.
- `get`: `i := sort.Search(len(t.index), func(i int) bool { return bytes.Compare(t.index[i].lastKey, key) >= 0 })`. Then `t.readBlock(t.index[i].h)`, `decodeBlock`, and scan. Return the error from either if they fail.

You will need to import `bytes` and `sort`. The iterator in `iterator.go` uses the same index search, if you want a reference.
<!-- /lang -->

## Flushing the memtable
<!-- mode: read-and-implement tasks:3.4 -->

### The order of operations is the whole design

A flush moves data from the log + memtable into a table. At every moment, a crash must leave each acknowledged write in at least one of them.

```plaintext
  1. write NNNNNN.sst.tmp  from the memtable iterator, then fsync
  2. rename .tmp → NNNNNN.sst, then fsync the directory   ← table is live
  3. open the table, put it first in the table list
  4. close the log, start an empty one                    ← log forgets
  5. replace the memtable with an empty one
```

| Crash after step | On restart |
| --- | --- |
| 1 | A `.tmp` file (deleted by `Open`) and the full log. Replay rebuilds the memtable. Nothing lost. |
| 2 or 3 | The table **and** the full log. Replay puts the same writes back in the memtable. Duplicated, not lost, and the memtable copy is identical. |
| 4 | The table and an empty log. Nothing lost. |

Swap steps 2 and 4 and there is a window where the data is in neither place.

> [!tip] Why rename and fsync the directory
> `rename` is atomic: other processes and a restarted engine see either no `NNNNNN.sst` or the whole one, never half. The rename itself is a change to the directory, so the directory has to be fsynced too, or a power cut can undo the rename.

### Newest first

Table numbers only grow, so a higher number means newer data. A lookup checks the memtable, then tables from the newest to the oldest, and stops at the first one that is not `Missing`. That loop is given in `DB.Get`; chapter 4 is all about making it fast.

<!-- lang: go -->
### `TODO(3.4)` — `flush`

In `internal/db/flush.go`. The table number and paths are given. Follow the five steps above:

1. `w, err := sstable.Create(tmp, d.writerOptions())`. Walk `d.mem.NewIterator()` from `SeekToFirst` and `w.Add(it.Kind(), it.Key(), it.Value())` every entry; on error, `w.Abort()` and return.
2. `w.Finish()`, `os.Rename(tmp, path)`, `syncDir(d.dir)`.
3. `t, err := sstable.Open(path)`, then `d.addTable(table{num: num, t: t})`, which puts it first in the table list. If `addTable` fails, close `t` and return the error.
4. `d.log.Close()`, then `d.log, err = wal.Create(filepath.Join(d.dir, walName), d.opts.Sync)`. If either fails, set `d.log = nil` so the DB refuses further writes.
5. `d.mem = memtable.New()`.

You will need to import `os`, `path/filepath`, and the `memtable`, `sstable`, and `wal` packages. `d.writerOptions()` and `d.addTable` are given in `db.go`; later chapters change them (a Bloom filter, a manifest) without changing your `flush`. `write` already calls `flush` when `ApproximateSize` reaches `MemtableSize`. `Flush` (exported) is there for the REPL and the tests.
<!-- /lang -->

## Prove it
<!-- mode: read-only -->

<!-- lang: go -->
```bash
make test     # every acceptance test
make race     # the same tests with the race detector
make run      # REPL: put, get, del, flush, stats
```
<!-- /lang -->

```plaintext
> put order:1 paid
OK
> del order:2
OK
> flush
OK
> stats
memtable entries=0 bytes=0  wal bytes=0  tables=1
> get order:1
"paid"
```

Look in `data/`: one `000001.sst` and an empty `wal.log`. Run `xxd data/000001.sst | tail -3` and find the magic number `7473 7376 6b6d 736c` ("lsmkvsst" read backwards, because it is little-endian) at the very end.

> [!check] Before you move on
> 1. An SSTable is sorted and immutable; newer data goes into newer tables.
> 2. The footer is fixed-size and last, so a reader can always find it.
> 3. A sparse index (one key per block) keeps lookups at one block read.
> 4. Flush makes the table durable before the log forgets.

### What is missing

Every flush adds a table. After a thousand flushes, looking up a key that does not exist reads a block from **every** table: a thousand disk reads to say "not found". And `scan` is gone from the REPL, because a range has to be stitched together from the memtable and many tables. Chapter 4 fixes both.
