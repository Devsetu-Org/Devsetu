## Where you are
<!-- mode: read-only -->

The index can return a posting list per term. A **boolean query** combines those lists: every term (AND), or at least one group of terms (OR).

```plaintext
  "cat dog"       →  docs that have cat AND dog
  "cat OR bird"   →  docs that have cat OR bird
  "cat dog OR fox"→  (cat AND dog) OR fox
```

> [!scope] This chapter's job
> Parse a query string, intersect lists, union lists. Phrase queries and NOT are out of scope.
> Ranking waits for chapter 5.

## Parse
<!-- mode: read-and-implement tasks:4.1 -->

Split the string on whitespace. A field that is exactly `OR` starts a new OR-group. Everything else in a group is joined and passed through `analyze.Analyze`, the same analyzer documents use. Empty groups (all stopwords) are dropped.

```plaintext
  "The Cat OR Dog Bird"  →  groups: [cat] , [dog, bird]
```

<!-- lang: go -->
### `TODO(4.1)` — `Parse`

In `internal/query/parse.go`: walk `strings.Fields(q)`. On `OR`, finish the current group. Analyze each finished group; skip empty token lists. Return `Query{Groups: ...}`.
<!-- /lang -->

## Intersect (AND)
<!-- mode: read-and-implement tasks:4.2 -->

Posting lists are sorted by doc id. Intersection is a two-pointer walk: advance the side with the smaller id; on equal, emit and advance both.

<!-- lang: go -->
`docIDs`, `intersectTwo`, and `unionTwo` are given. `Docs` (given) calls your `Intersect` for each AND-group and your `Union` across groups.
<!-- /lang -->

<!-- lang: go -->
### `TODO(4.2)` — `Intersect`

If there are no lists, or any list is empty, return nil. Convert each list to doc ids. Fold with `intersectTwo`. Return the sorted id slice.
<!-- /lang -->

## Union (OR)
<!-- mode: read-and-implement tasks:4.3 -->

<!-- lang: go -->
### `TODO(4.3)` — `Union`

Fold the lists with `unionTwo`. Equal ids appear once. The result stays sorted.
<!-- /lang -->

## Prove it
<!-- mode: read-only -->

<!-- lang: go -->
```bash
make test
make race
make run
```
<!-- /lang -->

> [!check] Before you move on
> 1. Space-separated terms are one AND group after analysis.
> 2. `OR` splits groups; stopwords inside a group can empty it.
> 3. Intersect and union keep ids sorted and unique.

### What is missing

Hit sets are unordered for relevance. Chapter 5 scores each survivor with BM25 and returns the top k.
