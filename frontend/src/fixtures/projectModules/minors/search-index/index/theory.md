## Where you are
<!-- mode: read-only -->

You can analyze text and write one segment. An **index** ties that to a directory: assign internal doc ids, remember each document's external id and length, buffer postings in memory, flush segments, and open everything again from `catalog.json`.

```plaintext
  findx-data/
    catalog.json
    segment-000000.fx
    segment-000001.fx
```

> [!scope] This chapter's job
> `Add`, `Flush`, and `Open`. No boolean queries yet, no BM25. When you finish, two flushes
> leave a catalog that `Open` can read back.

## Catalog
<!-- mode: read-only -->

<!-- lang: go -->
`Engine`, `Meta`, and `catalogFile` live in `internal/index/meta.go`. `writeCatalog` and the lookup helpers (`Postings`, `NumDocs`, `AvgDL`, …) are given. You implement `Add`, `Flush`, and `Open`.

The public wrapper `findx.Open` / `Add` / `Flush` calls into `Engine`.
<!-- /lang -->
<!-- lang: python -->
`Engine` and `Meta` live in `findx/index/meta.py`. `write_catalog` and the lookup helpers (`postings`, `num_docs`, `avg_dl`, …) are given. You implement `add`, `flush`, and `open_index`.

The public wrapper `findx.open_index_dir` / `add` / `flush` calls into `Engine`.
<!-- /lang -->
<!-- lang: cpp -->
`Engine` and `Meta` live in `src/index/engine.h`. `WriteCatalog` and the lookup helpers (`Postings`, `NumDocs`, `AvgDL`, …) are given. You implement `Add`, `Flush`, and `Open`.

The public wrapper `findx::Open` / `Add` / `Flush` calls into `Engine`.
<!-- /lang -->

Each document gets a dense internal `uint32` id (`0, 1, 2, …`). The caller’s string id is stored in the catalog for search results later. Document **length** is the number of tokens after analyze — BM25 needs it in chapter 5.

## Add a document
<!-- mode: read-and-implement tasks:3.1 -->

<!-- lang: go -->
### `TODO(3.1)` — `Engine.Add`

1. Reject an empty id and a duplicate `extToID` entry.
2. `tokens := analyze.Analyze(text)`. Build a term → tf map.
3. `docID := e.nextDoc`; increment `nextDoc`.
4. Store `Meta{ExtID: id, Len: len(tokens)}`, update `extToID` and `bufLens`.
5. For each term, `e.mem.Add(term, docID, tf)`.
<!-- /lang -->
<!-- lang: python -->
### `TODO(3.1)` — `add`

In `findx/index/add.py`:

1. Reject an empty id and a duplicate `e.ext_to_id` entry.
2. `tokens = analyze(text)`. Build a term → tf map.
3. `internal = e.next_doc`; increment `next_doc`.
4. Store `Meta(ext_id=id, length=len(tokens))`, update `ext_to_id` and `buf_lens`.
5. For each term, `e.mem.add(term, internal, tf)`.
<!-- /lang -->
<!-- lang: cpp -->
### `TODO(3.1)` — `Engine::Add`

1. Reject an empty id and a duplicate `ext_to_id` entry.
2. `tokens = analyze::Analyze(text)`. Build a term → tf map.
3. `doc_id = next_doc++`.
4. Store `Meta{id, length}`, update `ext_to_id` and `buf_lens`.
5. For each term, `mem.Add(term, doc_id, tf)`.
<!-- /lang -->

## Flush a segment
<!-- mode: read-and-implement tasks:3.2 -->

<!-- lang: go -->
### `TODO(3.2)` — `Engine.Flush`

1. If `e.mem` has no terms, return nil.
2. Create `segment-%06d.fx` using `len(e.segNames)` as the number.
3. `postings.WriteSegment`, then `OpenSegment`.
4. Append the name and segment; `Clear` the map; reset `bufLens`.
5. `return e.writeCatalog()`.
<!-- /lang -->
<!-- lang: python -->
### `TODO(3.2)` — `flush`

In `findx/index/flush.py`:

1. If `e.mem` has no terms, return.
2. Create `segment-%06d.fx` using `len(e.seg_names)` as the number.
3. `write_segment`, then `open_segment`.
4. Append the name and segment; `clear` the map; reset `buf_lens`.
5. Call `e.write_catalog()`.
<!-- /lang -->
<!-- lang: cpp -->
### `TODO(3.2)` — `Engine::Flush`

1. If `mem` has no terms, return.
2. Create `segment-%06d.fx` using `seg_names.size()` as the number.
3. `WriteSegmentToFile`, then `OpenSegment`.
4. Append the name and segment; `Clear` the map; reset `buf_lens`.
5. Call `WriteCatalog()`.
<!-- /lang -->

## Open from a directory
<!-- mode: read-and-implement tasks:3.3 -->

<!-- lang: go -->
### `TODO(3.3)` — `Open`

1. `MkdirAll` the directory. Allocate empty maps and `postings.NewMap()`.
2. If `catalog.json` is missing, `writeCatalog` and return the empty engine.
3. Otherwise unmarshal `catalogFile`, restore `nextDoc`, docs, and `extToID`.
4. For each segment name, `OpenSegment` under `dir` and append to `segNames` / `segs`.
<!-- /lang -->
<!-- lang: python -->
### `TODO(3.3)` — `open_index`

In `findx/index/open.py`:

1. `os.makedirs` the directory. Allocate an empty `Engine`.
2. If `catalog.json` is missing, `write_catalog` and return.
3. Otherwise load JSON, restore `next_doc`, docs, and `ext_to_id`.
4. For each segment name, `open_segment` under `dir` and append to `seg_names` / `segs`.
<!-- /lang -->
<!-- lang: cpp -->
### `TODO(3.3)` — `Open`

1. Create the directory. Allocate an empty `Engine`.
2. If `catalog.json` is missing, `WriteCatalog` and return.
3. Otherwise parse the catalog (use `LoadCatalog`), restore state.
4. For each segment name, `OpenSegment` under `dir` and append to `seg_names` / `segs`.
<!-- /lang -->

## Prove it
<!-- mode: read-only -->

<!-- lang: go -->
```bash
make test
make race
FINDX_DIR=/tmp/fx make run
```
<!-- /lang -->
<!-- lang: python -->
```bash
make test
FINDX_DIR=/tmp/fx make run
```
<!-- /lang -->
<!-- lang: cpp -->
```bash
make test
make asan
FINDX_DIR=/tmp/fx make run
```
<!-- /lang -->

In the REPL: `add d0 the cat sat`, `add d1 a cat and a dog`, `flush`.

> [!check] Before you move on
> 1. Two documents with the same external id are rejected.
> 2. After flush, a new `Open` sees the same postings and external ids.
> 3. A second flush creates `segment-000001.fx` and updates the catalog.

### What is missing

You can store documents but not ask questions. Chapter 4 walks posting lists with AND and OR.
