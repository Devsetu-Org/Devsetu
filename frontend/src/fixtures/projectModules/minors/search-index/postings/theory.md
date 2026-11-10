## Where you are
<!-- mode: read-only -->

Chapter 1 gave you tokens. This chapter builds the **inverted index** those tokens fill: for each term, a sorted list of `(docId, tf)` postings, first in memory, then on disk as a **segment**.

```plaintext
  cat → (doc 0, tf 2), (doc 3, tf 1)
  dog → (doc 1, tf 4)
```

> [!scope] This chapter's job
> In-memory map and one segment codec. No catalog of many segments, no queries, no BM25.
> When you finish, a map round-trips through `WriteSegment` / `DecodeSegment` and stays sorted by doc id.

## Postings in memory
<!-- mode: read-and-implement tasks:2.1 -->

A **posting** is one document's use of a term: the internal document id and the term frequency in that document.

Lists stay sorted by doc id. Sorted lists are what boolean retrieval intersects and unions in chapter 4.

<!-- lang: go -->
`Posting` and `Map` live in `internal/postings`. `NewMap`, `Terms`, `Postings`, and `Clear` are given. You implement `Add`.
<!-- /lang -->
<!-- lang: python -->
`Posting` and `Map` live in `findx/postings`. `terms_sorted`, `postings`, and `clear` are given. You implement `add`.
<!-- /lang -->
<!-- lang: cpp -->
`Posting` and `Map` live in `src/postings`. `Terms`, `Postings`, and `Clear` are given. You implement `Add`.
<!-- /lang -->

<!-- lang: go -->
### `TODO(2.1)` — `Map.Add`

1. Ensure `m.terms` is non-nil.
2. Find the first index whose `DocID >= docID` with `sort.Search`.
3. If that slot has the same `DocID`, replace `TF`.
4. Otherwise insert `Posting{DocID: docID, TF: tf}` so the slice stays ordered.
<!-- /lang -->
<!-- lang: python -->
### `TODO(2.1)` — `Map.add`

1. Find the insertion point with `bisect` on `doc_id`.
2. If that slot has the same `doc_id`, replace `tf`.
3. Otherwise insert `Posting(doc_id, tf)` so the list stays ordered.
<!-- /lang -->
<!-- lang: cpp -->
### `TODO(2.1)` — `Map::Add`

1. Find the insertion point with `std::lower_bound` on `doc_id`.
2. If that slot has the same `doc_id`, replace `tf`.
3. Otherwise insert `Posting{doc_id, tf}` so the vector stays ordered.
<!-- /lang -->

## Segment layout
<!-- mode: read-only -->

A segment is one flush of the map. The file is little-endian:

```plaintext
  "FNDX" | version=1 | nTerms
  directory:  nameLen u16 | name | dataOff u32 | count u32   (terms sorted)
  data:       for each term, count × (docID u32 | tf u32)
```

`dataOff` is an offset into the data region (not into the whole file). Looking up a term is a map (or binary search) in the directory, then a sequential read of `count` pairs.

## Encode
<!-- mode: read-and-implement tasks:2.2 -->

<!-- lang: go -->
### `TODO(2.2)` — `WriteSegment`

1. For each term in `m.Terms()` order, append `count` postings to a data buffer and record `(dataOff, count)` for the directory.
2. Write the 12-byte header (`FNDX`, version `1`, `nTerms`).
3. Write the directory entries, then the data buffer.
<!-- /lang -->
<!-- lang: python -->
### `TODO(2.2)` — `write_segment`

1. For each term in `m.terms_sorted()` order, append `count` postings to a data buffer and record `(data_off, count)` for the directory.
2. Write the 12-byte header (`FNDX`, version `1`, `nTerms`).
3. Write the directory entries, then the data buffer. Use `struct.pack("<I", …)` / `struct.pack("<H", …)`.
<!-- /lang -->
<!-- lang: cpp -->
### `TODO(2.2)` — `WriteSegment`

1. For each term in `m.Terms()` order, append `count` postings to a data buffer and record `(dataOff, count)` for the directory.
2. Write the 12-byte header (`FNDX`, version `1`, `nTerms`).
3. Write the directory entries, then the data buffer (little-endian).
<!-- /lang -->

## Decode and seek
<!-- mode: read-and-implement tasks:2.3 -->

<!-- lang: go -->
### `TODO(2.3)` — `DecodeSegment` and `Segment.Postings`

`DecodeSegment`:

1. Reject a bad magic or version.
2. Read `nTerms` directory entries into `map[string]entry`.
3. The remainder of the file is `data`.

`Postings`: look up the term; if missing, return `ok=false`. Otherwise read `count` little-endian `(docID, tf)` pairs starting at `off` in `data`.

`OpenSegment` is given: it reads the file and calls `DecodeSegment`.
<!-- /lang -->
<!-- lang: python -->
### `TODO(2.3)` — `decode_segment` and `Segment.postings`

`decode_segment`:

1. Reject a bad magic or version.
2. Read `nTerms` directory entries into a dict of `_Entry`.
3. The remainder of the file is `data`.

`postings`: look up the term; if missing, return `([], False)`. Otherwise read `count` little-endian `(doc_id, tf)` pairs starting at `off` in `data`.

`open_segment` is given: it reads the file and calls `decode_segment`.
<!-- /lang -->
<!-- lang: cpp -->
### `TODO(2.3)` — `DecodeSegment` and `Segment::Postings`

`DecodeSegment`:

1. Reject a bad magic or version.
2. Read `nTerms` directory entries into a map of `Entry`.
3. The remainder of the file is `data`.

`Postings`: look up the term; if missing, return `{ {}, false }`. Otherwise read `count` little-endian `(doc_id, tf)` pairs starting at `off` in `data`.

`OpenSegment` is given: it reads the file and calls `DecodeSegment`.
<!-- /lang -->

## Prove it
<!-- mode: read-only -->

<!-- lang: go -->
```bash
make test
make race
printf '%s\n' "cat sat" "cat dog" | make run > /tmp/seg.fx
```
<!-- /lang -->
<!-- lang: python -->
```bash
make test
printf '%s\n' "cat sat" "cat dog" | make run > /tmp/seg.fx
```
<!-- /lang -->
<!-- lang: cpp -->
```bash
make test
make asan
printf '%s\n' "cat sat" "cat dog" | make run > /tmp/seg.fx
```
<!-- /lang -->

> [!check] Before you move on
> 1. `Add` keeps each term's list sorted by doc id and replaces TF on a repeat.
> 2. A segment round-trip preserves every posting.
> 3. A missing term returns `ok=false`.

### What is missing

One segment is not an index. Chapter 3 assigns document ids, flushes many segments, and opens a catalog from a directory.
