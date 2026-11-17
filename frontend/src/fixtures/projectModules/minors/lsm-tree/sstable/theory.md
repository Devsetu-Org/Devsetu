## SSTables
<!-- mode: read-only -->

Chapter 2 made writes durable, at a price: the log only grows, every key lives in RAM forever, and startup replays the entire history. This chapter moves data out of memory and onto disk as **SSTables** (sorted string tables): one file each, keys in order, never modified again. Then the log is started fresh, because the table now holds everything the log did.

![LSM path chapter 3: SSTables highlighted after WAL and Memtable](/lsm-tree/sstable/you-are-here.jpg)

> [!scope] This chapter's job
> Write and read SSTables, and flush the memtable into them. Lookups check tables newest first with a simple loop (given). Chapter 4 makes that fast with Bloom filters, and chapter 5 merges the tables that pile up.

### Sorted, immutable, self-describing

- **Sorted**: keys are written in increasing order — exactly what the memtable iterator from chapter 1 produces.
- **Immutable**: once written, a table is never changed. Newer data goes into newer tables. That makes tables safe to read without locks, cache, copy, and back up.
- **Self-describing**: an index and a footer at the end let a reader find any key without scanning the file.

### The layout

![SSTable file: data blocks, filter block, index block, footer; Open starts at the footer](/lsm-tree/sstable/layout.jpg)

A reader starts at the **end**: the footer has a fixed size, so it is always the last 40 bytes. The footer points at the index, the index points at the data blocks.

| Piece | Encoding |
| --- | --- |
| entry | `kind u8 · uvarint keyLen · key · uvarint valueLen · value` |
| index entry | `uvarint keyLen · lastKey · uvarint offset · uvarint length` |
| footer | `filterOff u64 · filterLen u64 · indexOff u64 · indexLen u64 · magic u64` |

`format` (given) encodes and decodes all three. Your job is the structure: which bytes go where, and how a reader uses them.

> [!tip] Tombstones go to disk too
> A flushed tombstone still has to hide older values in older tables. So the table keeps entries of both kinds, exactly like the memtable did.

## Writing and reading a table
<!-- mode: read-and-implement tasks:3.1,3.2,3.3 -->

### Why blocks

You could write one long run of entries and index every key. The index would be as big as the data. Instead, entries are grouped into **blocks** of about 4 KiB, and the index holds one entry per block: the block's **last key** and its position.

![Sparse index maps last keys to blocks; Get reads exactly one 4 KiB block](/lsm-tree/sstable/sparse-index.jpg)

A 64 MiB table has about 16,000 blocks, so its index is a few hundred KiB and fits in memory. Every lookup then costs **one** block read.

> [!idea] Real engines go further
> LevelDB and RocksDB compress each block, store keys with shared-prefix encoding, and binary-search inside a block with restart points. Same structure, fewer bytes.

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
<!-- lang: python -->
### `TODO(3.1)` — `add` and `flush_block`

In `lsmkv/sstable/build.py`. Reject out-of-order keys with `OutOfOrderError`. Append with `append_entry`, copy into `w.last_key`, and call `flush_block` once the block reaches `w.opts.block_size`. `flush_block` writes a non-empty block and records an index entry.

### `TODO(3.2)` — `finish`

In `lsmkv/sstable/build.py`. The given `finish` has already flushed the last partial block and written the filter block (may be empty this chapter).

1. `index_h = write_block(w.index)`.
2. Write `encode_footer(filter_h, index_h)` to the output.
3. Flush the output, `fsync` the file, and close it. Readers must not see a partial table after a crash.
<!-- /lang -->
<!-- lang: cpp -->
### `TODO(3.1)` — `add` and `flushBlock`

In `src/sstable/build.cc`. Reject out-of-order keys with `OutOfOrderError`. Append with `AppendEntry`, copy into `last_key_`, and call `flushBlock` once the block reaches `opts_.block_size`. `flushBlock` writes a non-empty block and records an index entry.

### `TODO(3.2)` — `finish`

In `src/sstable/build.cc`. The given `Finish` has already flushed the last partial block and written the filter block (may be empty this chapter).

1. `index_h = writeBlock(index_)`.
2. Write `EncodeFooter(filter, index_h)` to the output.
3. Flush the output, `fsync` the file, and close it. Readers must not see a partial table after a crash.
<!-- /lang -->

### Open once, look up many times

Opening a table reads two things and keeps them in memory: the footer and the index. Data blocks stay on disk until a lookup asks for one. Every block read checks its CRC trailer, so a damaged file gives an error instead of wrong data.

Get binary-searches the index for the first block whose last key is `>=` the target, reads that one block, and scans it for `Found`, `Deleted`, or `Missing` — the same three answers as the memtable.

<!-- lang: go -->
### `TODO(3.3)` — `open` and `get`

In `internal/sstable/lookup.go`. The public `Open` and `Get` in `reader.go` are given and call these two.

- `open`: read the footer with `f.ReadAt(footer, t.size-footerSize)`, then `decodeFooter` (it checks the magic number). `t.readBlock(indexHandle)` reads the index and checks its CRC; `decodeIndex` turns it into `t.index`. Return `t` and the filter handle from the footer: `Open` hands it to the filter loader, which does nothing until chapter 4.
- `get`: `i := sort.Search(len(t.index), func(i int) bool { return bytes.Compare(t.index[i].lastKey, key) >= 0 })`. Then `t.readBlock(t.index[i].h)`, `decodeBlock`, and scan. Return the error from either if they fail.

You will need to import `bytes` and `sort`. The iterator in `iterator.go` uses the same index search, if you want a reference.
<!-- /lang -->
<!-- lang: python -->
### `TODO(3.3)` — `open_table` and `get`

In `lsmkv/sstable/lookup.py`. Read the footer, load the index with `read_block` / `decode_index`. `get` binary-searches the index and reads exactly one data block.
<!-- /lang -->
<!-- lang: cpp -->
### `TODO(3.3)` — `OpenFile` and `get`

In `src/sstable/lookup.cc`. Read the footer, load the index with `ReadBlock` / `DecodeIndex`. `get` binary-searches the index and reads exactly one data block.
<!-- /lang -->

## Flushing the memtable
<!-- mode: read-and-implement tasks:3.4 -->

### The order of operations is the whole design

A flush moves data from the log + memtable into a table. At every moment, a crash must leave each acknowledged write in at least one of them.

![Flush steps: write temp, rename live, open table, reset WAL, empty memtable](/lsm-tree/sstable/flush.jpg)

| Crash after step | On restart |
| --- | --- |
| 1 | A `.tmp` file (deleted by `Open`) and the full log. Replay rebuilds the memtable. Nothing lost. |
| 2 or 3 | The table **and** the full log. Replay puts the same writes back in the memtable. Duplicated, not lost. |
| 4 | The table and an empty log. Nothing lost. |

Swap the rename and the log reset and there is a window where the data is in neither place.

> [!tip] Why rename and fsync the directory
> `rename` is atomic: other processes and a restarted engine see either no `NNNNNN.sst` or the whole one, never half. The rename itself is a change to the directory, so the directory has to be fsynced too, or a power cut can undo the rename.

### Newest first

Table numbers only grow, so a higher number means newer data. A lookup checks the memtable, then tables from newest to oldest, and stops at the first one that is not `Missing`. That loop is given in `DB.Get`; chapter 4 is all about making it fast.

<!-- lang: go -->
### `TODO(3.4)` — `flush`

In `internal/db/flush.go`. The table number and paths are given. Follow the five steps:

1. `w, err := sstable.Create(tmp, d.writerOptions())`. Walk `d.mem.NewIterator()` from `SeekToFirst` and `w.Add(it.Kind(), it.Key(), it.Value())` every entry; on error, `w.Abort()` and return.
2. `w.Finish()`, `os.Rename(tmp, path)`, `syncDir(d.dir)`.
3. `t, err := sstable.Open(path)`, then `d.addTable(table{num: num, t: t})`, which puts it first in the table list. If `addTable` fails, close `t` and return the error.
4. `d.log.Close()`, then `d.log, err = wal.Create(filepath.Join(d.dir, walName), d.opts.Sync)`. If either fails, set `d.log = nil` so the DB refuses further writes.
5. `d.mem = memtable.New()`.

You will need to import `os`, `path/filepath`, and the `memtable`, `sstable`, and `wal` packages. `d.writerOptions()` and `d.addTable` are given in `db.go`; later chapters change them without changing your `flush`.
<!-- /lang -->
<!-- lang: python -->
### `TODO(3.4)` — `flush`

In `lsmkv/db/flush.py`. Write the memtable to a temp table, rename it into place, `add_table`, then reset the log and memtable.
<!-- /lang -->
<!-- lang: cpp -->
### `TODO(3.4)` — `flush`

In `src/db/flush.cc`. Write the memtable to a temp table, rename it into place, `addTable`, then reset the log and memtable.
<!-- /lang -->

### Prove it

<!-- lang: go -->
```bash
make test     # every acceptance test
make race     # the same tests with the race detector
make run      # REPL: put, get, del, flush, stats
```
<!-- /lang -->
<!-- lang: python -->
```bash
make test
make run
```
<!-- /lang -->
<!-- lang: cpp -->
```bash
make test
make asan
make run
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

Every flush adds a table. After a thousand flushes, looking up a key that does not exist reads a block from **every** table. And `scan` is gone from the REPL, because a range has to be stitched together from the memtable and many tables. Chapter 4 fixes both.
