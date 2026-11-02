# Search index minor — authoring model

Chaptered minor. Overview ready; build chapters in Go. Minor stays `planned`.
Benchmark planned.

## Chapters

| # | id | Status | Student focus | Author-owned |
| --- | --- | --- | --- | --- |
| 0 | `overview` | **ready** | reading (`searchOverview.ts`) | sync with `minors.ts` |
| 1 | `analyze` | **ready** (Go) | 1.1 tokenize, 1.2 lowercase, 1.3 stopwords | stopword list |
| 2 | `postings` | **ready** (Go) | 2.1 add term, 2.2 encode segment, 2.3 decode+seek | segment file format |
| 3 | `index` | **ready** (Go) | 3.1 add doc, 3.2 flush, 3.3 open catalog | doc store (id→len) |
| 4 | `query` | **ready** (Go) | 4.1 analyze query, 4.2 AND intersect, 4.3 OR union | iterator helpers |
| 5 | `rank` | **ready** (Go) | 5.1 collection stats, 5.2 BM25 score, 5.3 top-k | k1=1.2, b=0.75 |
| 6 | `benchmark` | planned | placeholder | — |

## Product

**`findx`**. Module `github.com/devlabs/findx`. Directory-backed index. API:

```go
idx := findx.Open(dir)
idx.Add(id string, text string) error
idx.Flush() error
hits, err := idx.Search(query string, k int) // ranked
```

Boolean query syntax in v1: space-separated terms are AND; `OR` as infix token
between terms/groups is enough (`cat AND dog` can be implicit AND). Keep it
simple: `Search` takes a string, analyzer runs, all terms AND by default; support
`OR` between terms. No phrases, no positions, no NOT.

BM25: k1=1.2, b=0.75. Avg doc length from catalog. Ties break on ascending doc id.

## Layout / rules

Same as other minors.

## Package layout (ch5)

```
cmd/findx/main.go
internal/analyze/
internal/postings/
internal/index/
internal/query/
internal/rank/
internal/findx/   // Open, Add, Flush, Search
```
