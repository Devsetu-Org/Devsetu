# Search index minor — authoring model

Chaptered minor. Overview ready; build chapters in Go, Python, and C++. Minor stays `planned`.
Benchmark planned.

Languages are Go, Python and C++. The learner picks a language inside a chapter; it
travels as `?lang=` and is remembered per minor.

## Chapters

| # | id | Status | Student focus | Author-owned |
| --- | --- | --- | --- | --- |
| 0 | `overview` | **ready** | reading (`searchOverview.ts`) | sync with `minors.ts` |
| 1 | `analyze` | **ready** (go, python, cpp) | 1.1 tokenize, 1.2 lowercase, 1.3 stopwords | stopword list |
| 2 | `postings` | **ready** (go, python, cpp) | 2.1 add term, 2.2 encode segment, 2.3 decode+seek | segment file format |
| 3 | `index` | **ready** (go, python, cpp) | 3.1 add doc, 3.2 flush, 3.3 open catalog | doc store (id→len) |
| 4 | `query` | **ready** (go, python, cpp) | 4.1 analyze query, 4.2 AND intersect, 4.3 OR union | iterator helpers |
| 5 | `rank` | **ready** (go, python, cpp) | 5.1 collection stats, 5.2 BM25 score, 5.3 top-k | k1=1.2, b=0.75 |
| 6 | `benchmark` | planned | placeholder | — |

## Product

**`findx`**. Directory-backed index. API (same shape in every language):

```
idx = Open(dir)
idx.Add(id, text)
idx.Flush()
hits = idx.Search(query, k)  # ranked
```

Boolean query syntax in v1: space-separated terms are AND; `OR` as infix token
between terms/groups is enough (`cat AND dog` can be implicit AND). Keep it
simple: `Search` takes a string, analyzer runs, all terms AND by default; support
`OR` between terms. No phrases, no positions, no NOT.

BM25: k1=1.2, b=0.75. Avg doc length from catalog. Ties break on ascending doc id.

## Layout

```
<chapter>/
  theory.md            shared by every language
  go/files/            starter repo      go/solution/      edited files only
  python/files/        starter repo      python/solution/
  cpp/files/           starter repo      cpp/solution/
```

Module / package paths:

| Language | Path |
| --- | --- |
| Go | `github.com/devlabs/findx` (`internal/analyze`, `internal/postings`, `internal/index`, `internal/query`, `internal/rank`, `internal/findx`) |
| Python | `findx` (`findx/analyze`, `findx/postings`, `findx/index`, `findx/query`, `findx/rank`, `findx/findx.py`) |
| C++ | `src/analyze`, `src/postings`, `src/index`, `src/query`, `src/rank`, `src/findx` |

Chapters 1–5 are registered in `searchIndexChaptersGo.ts`, `searchIndexChaptersPython.ts`, and `searchIndexChaptersCpp.ts`, which glob each `<chapter>/<lang>/files/**` (never `solution/`).

## Package layout (ch5)

```
# Go
cmd/findx/main.go
internal/analyze/
internal/postings/
internal/index/
internal/query/
internal/rank/
internal/findx/   // Open, Add, Flush, Search

# Python
findx/__main__.py
findx/analyze/
findx/postings/
findx/index/
findx/query/
findx/rank/
findx/findx.py    # open_index_dir, Add, Flush, Search

# C++
cmd/findx/main.cc
src/analyze/
src/postings/
src/index/
src/query/
src/rank/
src/findx/        // Open, Add, Flush, Search
```

## Rules

Same as the other minors: scratch repos per chapter, `TODO(N.x)` markers, shared
`theory.md` with `<!-- lang: go -->` / `python` / `cpp` blocks, no hard wrapping, starters compile,
`solution/` never globbed into the bundle, learner-owned files stable across
later chapters (carry-forward via `utils/chapterCarry.ts`).

- Task ids, task count and test cases are the same in every language. A port
  changes syntax and idiom, never what the chapter teaches or checks.
- No third-party dependencies: Go stdlib, Python stdlib `unittest` (3.9+),
  C++17 with a plain Makefile and `tests/check.h`.
- Starters must compile / import. Solutions pass `make test` (Go also `make race`; C++ also `make asan`).
