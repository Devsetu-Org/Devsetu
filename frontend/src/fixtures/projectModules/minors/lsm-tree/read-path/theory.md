## The read path
<!-- mode: read-only -->

The store now writes durably and flushes to SSTables. Reads work, but they get slower with every flush, and range scans are gone. This chapter fixes both: **Bloom filters** skip tables that cannot hold a key, and a **merging iterator** stitches the memtable and every table into one ordered stream.

![LSM path chapter 4: memtable then many SSTables; filters skip, merge scans all](/lsm-tree/read-path/you-are-here.jpg)

> [!scope] This chapter's job
> Make point lookups skip tables that cannot hold the key, and make range scans work across the memtable and every table. Chapter 5 then reduces how many tables there are in the first place.

### Newest first, every time

`DB.Get` checks the memtable, then each table from newest to oldest, and stops at the first one that is not `Missing`:

| Result in a table | Meaning | What Get does |
| --- | --- | --- |
| `Found` | the newest value for the key | return it |
| `Deleted` | the key was deleted after any older value | return "not found" |
| `Missing` | this table says nothing about the key | try the next older table |

That is correct, and it is slow for one very common case: a key that does not exist. With 50 tables, "not found" costs up to 50 block reads. This is **read amplification**: one logical read becomes many physical ones.

### Range scans need every source at once

A scan from `order:100` to `order:200` cannot ask one table at a time. Keys in that range are spread across the memtable and many tables, some overwritten, some deleted. The answer has to be assembled from all of them in key order.

## Bloom filters
<!-- mode: read-and-implement tasks:4.1,4.2 -->

### Definitely not, or maybe

A **Bloom filter** is an array of `m` bits and `k` hash functions. To add a key, hash it `k` ways and set those `k` bits. To query a key, check the same `k` bits.

![Bloom filter: a zero bit means definitely not; all ones means maybe](/lsm-tree/read-path/bloom.jpg)

- If any bit is 0, the key was **never** added. No false negatives, ever.
- If all bits are 1, the key was **probably** added. Other keys may have set those bits.

Each table gets a filter over its keys, written as the filter block chapter 3 left room for. The wiring is given: writers feed every key to a filter builder, and `Get` asks the filter before calling your chapter 3 lookup. A "no" costs a few memory lookups instead of a disk read.

### How many bits, how many hashes

| Bits per key | Best k | False-positive rate |
| --- | --- | --- |
| 4 | 2 | about 15% |
| 10 | 6 | about 1% |
| 16 | 11 | under 0.1% |

The best `k` is `bitsPerKey × ln 2 ≈ bitsPerKey × 0.69`. RocksDB's default is 10 bits per key: a 1% false-positive rate for about 1.25 bytes per key.

> [!tip] Two hashes are enough
> Computing k independent hashes is slow. Kirsch and Mitzenmacher showed that probe i = h1 + i·h2 (from two halves of one 64-bit hash) gives the same false-positive rate. `probe` (given) does exactly that, and LevelDB and RocksDB use the same trick.

<!-- lang: go -->
### `TODO(4.1)` — `Finish`

In `internal/bloom/bloom.go`. `nBits` (at least 64) is computed for you.

1. `nBytes := (nBits + 7) / 8` and `m := uint32(nBytes * 8)`.
2. `k := numProbes(b.bitsPerKey)`.
3. `filter := make([]byte, nBytes+1)` and `filter[nBytes] = byte(k)`. Storing k in the filter lets a reader decode a filter written with different settings.
4. For every `h` in `b.hashes` and every `i` in `[0, k)`: `bit := probe(h, uint32(i), m)`, then `filter[bit/8] |= 1 << (bit % 8)`.

### `TODO(4.2)` — `MayContain`

1. If `len(filter) < 2`, return true.
2. `k := int(filter[len(filter)-1])`. If `k < 1 || k > maxProbes`, return true. A filter you cannot read must never hide a key.
3. `m := uint32((len(filter) - 1) * 8)` and `h := hash(key)`.
4. For each `i` in `[0, k)`: if bit `probe(h, uint32(i), m)` is 0, return false.
5. Return true.
<!-- /lang -->
<!-- lang: python -->
### `TODO(4.1)` — `finish`

In `lsmkv/bloom/bloom.py`. `n_bits` (at least 64) is computed for you.

1. `n_bytes = (n_bits + 7) // 8` and `m = n_bytes * 8`.
2. `k = num_probes(self.bits_per_key)`.
3. `filter = bytearray(n_bytes + 1)` and `filter[n_bytes] = k`. Storing k in the filter lets a reader decode a filter written with different settings.
4. For every `h` in `self.hashes` and every `i` in `range(k)`: `bit = probe(h, i, m)`, then set `filter[bit // 8] |= 1 << (bit % 8)`.

### `TODO(4.2)` — `may_contain`

1. If `len(filter) < 2`, return `True`.
2. `k = filter[-1]`. If `k < 1` or `k > max_probes`, return `True`. A filter you cannot read must never hide a key.
3. `m = (len(filter) - 1) * 8` and `h = hash(key)`.
4. For each `i` in `range(k)`: if bit `probe(h, i, m)` is 0, return `False`.
5. Return `True`.
<!-- /lang -->
<!-- lang: cpp -->
### `TODO(4.1)` — `Finish`

In `src/bloom/bloom.cc`. `nBits` (at least 64) is computed for you.

1. `nBytes = (nBits + 7) / 8` and `m = static_cast<uint32_t>(nBytes * 8)`.
2. `k = NumProbes(bits_per_key_)`.
3. `filter` is `nBytes + 1` bytes; `filter[nBytes] = static_cast<uint8_t>(k)`. Storing k in the filter lets a reader decode a filter written with different settings.
4. For every `h` in `hashes_` and every `i` in `[0, k)`: `bit = Probe(h, i, m)`, then `filter[bit/8] |= 1 << (bit % 8)`.

### `TODO(4.2)` — `MayContain`

1. If `filter.size() < 2`, return true.
2. `k = filter.back()`. If `k < 1` or `k > kMaxProbes`, return true. A filter you cannot read must never hide a key.
3. `m = static_cast<uint32_t>((filter.size() - 1) * 8)` and `h = Hash(key)`.
4. For each `i` in `[0, k)`: if bit `Probe(h, i, m)` is 0, return false.
5. Return true.
<!-- /lang -->

## Merging and range scans
<!-- mode: read-and-implement tasks:4.3,4.4 -->

### A k-way merge with a heap

Every source (the memtable and each table) already iterates in key order. Merging them is the same idea as the merge step of merge sort, with `k` inputs instead of two. A **min-heap** holds one current entry per source; the smallest key is always on top.

![K-way merge: heap picks newest source for equal keys, then advances all ties](/lsm-tree/read-path/merge.jpg)

When two sources hold the same key, the heap must put the **newer** one on top: compare keys first, and for equal keys the lower rank (newer) wins. Then, when moving on, advance **every** source that is sitting on that key, so the older copies are skipped.

> [!warn] Copy the key before you advance
> `Key()` returns a slice into the iterator's own storage. After the top child moves, that slice may hold a different key. Copy the current key first, then advance children while they still equal the copy. One test hands out a reused buffer to catch exactly this.

<!-- lang: go -->
### `TODO(4.3)` — `Less` and `Next`

In `internal/iterator/merging.go`. The heap plumbing (`Push`, `Pop`, `Swap`, `rebuild`) is given.

- `Less(i, j)`: `bytes.Compare` the two keys; if they differ, the smaller key is less. If they are equal, `h[i].rank < h[j].rank`.
- `Next`: `key := append([]byte(nil), m.h[0].it.Key()...)`. While the heap is not empty and `bytes.Equal(m.h[0].it.Key(), key)`: advance that child with `Next()`; if it is still `Valid`, `heap.Fix(&m.h, 0)`, otherwise `heap.Pop(&m.h)`.

You will need to import `bytes`.
<!-- /lang -->
<!-- lang: python -->
### `TODO(4.3)` — `Less` and `next`

In `lsmkv/iterator/merging.py`. The heap plumbing (`push`, `pop`, `swap`, `rebuild`) is given.

- `Less(i, j)`: compare the two keys; if they differ, the smaller key is less. If they are equal, `h[i].rank < h[j].rank` (lower rank is newer).
- `next`: `key = bytes(self.h[0].it.key())`. While the heap is not empty and `self.h[0].it.key() == key`: advance that child with `next()`; if it is still valid, `heapq.heapify` or fix that position, otherwise pop it.
<!-- /lang -->
<!-- lang: cpp -->
### `TODO(4.3)` — `Less` and `Next`

In `src/iterator/merging.cc`. The heap plumbing is given.

- `Less(i, j)`: compare the two keys; if they differ, the smaller key is less. If they are equal, `h_[i].rank < h_[j].rank` (lower rank is newer).
- `Next`: copy `key` from `h_[0].it->Key()`. While the heap is not empty and `h_[0].it->Key() == key`: advance that child; if it is still valid, `std::push_heap` / fix, otherwise remove it from the heap.
<!-- /lang -->

### The merge returns tombstones on purpose

The merging iterator reports tombstones like any other entry. That is deliberate: chapter 5's compaction needs to see them. A user-facing scan is where they disappear. If the newest entry for a key is a tombstone, the key is skipped, and the older values the merge already skipped stay hidden.

![Scan emits live values, skips tombstones, stops at the end key](/lsm-tree/read-path/scan.jpg)

<!-- lang: go -->
### `TODO(4.4)` — `Scan`

In `internal/db/scan.go`, with the lock held (given):

1. `children := []iterator.Iterator{d.mem.NewIterator()}`, then each `t.t.NewIterator()` from `d.tables` in order. Keep the `*sstable.Iterator`s in a second slice for the error check.
2. `m := iterator.NewMerging(children...)`; `m.SeekToFirst()` if `start == nil`, else `m.Seek(start)`.
3. For each entry: if `end != nil` and `bytes.Compare(m.Key(), end) >= 0`, stop. Skip `memtable.KindTombstone`. Call `fn`; stop if it returns false.
4. Return the first non-nil `Err()` from the table iterators.

You will need to import `bytes` and the `iterator`, `memtable`, and `sstable` packages.
<!-- /lang -->
<!-- lang: python -->
### `TODO(4.4)` — `scan`

In `lsmkv/db/scan.py`, with the lock held (given):

1. Build `children` from `d.mem.new_iterator()` then each table's iterator in `d.tables` order. Keep the table iterators in a second list for the error check.
2. `m = Merging(children)`; `seek_to_first()` if `start` is `None`, else `seek(start)`.
3. For each entry: if `end` is not `None` and `m.key() >= end`, stop. Skip tombstone kinds. Call `fn`; stop if it returns `False`.
4. Return the first non-`None` `err()` from the table iterators.
<!-- /lang -->
<!-- lang: cpp -->
### `TODO(4.4)` — `Scan`

In `src/db/scan.cc`, with the lock held (given):

1. Build `children` from `mem.NewIterator()` then each table's iterator in `tables_` order. Keep the SSTable iterators in a second vector for the error check.
2. `m = NewMerging(children)`; `SeekToFirst()` if `start` is empty, else `Seek(start)`.
3. For each entry: if `end` is set and `Compare(m.Key(), end) >= 0`, stop. Skip tombstone kinds. Call `fn`; stop if it returns false.
4. Return the first non-ok `Err()` from the table iterators.
<!-- /lang -->

### Prove it

<!-- lang: go -->
```bash
make test     # every acceptance test
make race     # the same tests with the race detector
go test -v -run FalsePositive ./internal/bloom   # see the measured rates
make run      # REPL with scan
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
> put order:1 pending
> put order:2 pending
> flush
> put order:1 paid
> del order:2
> put order:3 new
> scan
order:1  "paid"
order:3  "new"
```

(Each write and the flush print `OK`; left out here.) `order:1` comes from the memtable and hides the flushed `pending`. `order:2` has a tombstone in the memtable, so the flushed value stays hidden.

> [!check] Before you move on
> 1. A Bloom filter never says no to a key it holds; it sometimes says maybe to one it does not.
> 2. 10 bits per key buys about a 1% false-positive rate.
> 3. A k-way merge uses a heap; equal keys go to the newest source.
> 4. Tombstones flow through the merge and are hidden at the edge, in `Scan` and `Get`.

Filters make "not found" cheap, but tables still pile up. Every overwrite and every delete leaves the old version on disk forever, and a scan still merges every table. Chapter 5 adds **compaction**: merge tables into one, keep only the newest version of each key, and drop tombstones that have nothing left to hide.
