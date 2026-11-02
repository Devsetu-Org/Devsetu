## Where you are
<!-- mode: read-only -->

Boolean retrieval says which documents match. **BM25** says which ones come first. You will collect collection statistics, score each hit, and keep the top k. Ties break on ascending internal doc id.

```plaintext
  query tokens → candidate docs → BM25 score → sort → top k
```

> [!scope] This chapter's job
> Stats, BM25, and top-k. Phrase queries stay out. When you finish, `findx.Search` returns
> ranked hits whose order matches the reference on a fixed corpus.

## Collection stats
<!-- mode: read-and-implement tasks:5.1 -->

BM25 needs:

| Symbol | Meaning |
| --- | --- |
| N | number of documents |
| avgdl | average document length (token count) |
| df(t) | number of documents that contain term t |

<!-- lang: go -->
### `TODO(5.1)` — `CollectStats`

Return `Stats{N: src.NumDocs(), AvgDL: src.AvgDL()}` and a map from each distinct term to `src.DF(term)`.
<!-- /lang -->

## BM25
<!-- mode: read-and-implement tasks:5.2 -->

Parameters are fixed: `k1 = 1.2`, `b = 0.75`.

```plaintext
  idf(t) = ln( 1 + (N - df + 0.5) / (df + 0.5) )

  score(t, d) = idf(t) · (tf · (k1+1)) / (tf + k1 · (1 - b + b · |d|/avgdl))
```

Sum `score(t, d)` over query terms that appear in `d`.

<!-- lang: go -->
### `TODO(5.2)` — `IDF` and `Score`

`IDF`: return 0 if `n == 0` or `df < 0`; otherwise the formula above with `math.Log`.

`Score`: return 0 if `tf <= 0`, `st.N == 0`, or `st.AvgDL == 0`. Otherwise `IDF(st.N, df)` times the tf saturation term with `K1` and `B`.
<!-- /lang -->

## Top k
<!-- mode: read-and-implement tasks:5.3 -->

<!-- lang: go -->
### `TODO(5.3)` — `TopK`

Copy `hits`. Sort with `sort.SliceStable`: higher `Score` first; on a tie, lower `DocID` first. If `k > 0` and there are more than `k` hits, truncate.
<!-- /lang -->

`findx.Search` (given) parses the query, retrieves candidates, scores them, and maps internal ids back to external ids.

## Prove it
<!-- mode: read-only -->

<!-- lang: go -->
```bash
make test
make race
FINDX_DIR=/tmp/fx make run
```
<!-- /lang -->

Add a few documents, `flush`, then `search 5 cat`.

> [!check] Before you move on
> 1. Higher tf for a rare term scores higher, all else equal.
> 2. Equal scores order by ascending doc id.
> 3. `search` with `k=1` returns a single hit.

### What is missing

Segment merges under load, positional phrases, and learning-to-rank. Lucene has those. You have analyzer → postings → boolean → BM25.
