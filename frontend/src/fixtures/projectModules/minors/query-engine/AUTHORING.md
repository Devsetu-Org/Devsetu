# Query engine minor — authoring model

A chaptered minor: `constants/minors.ts` lists the chapters, and each `ready`
chapter has a fixture per language registered in `MINOR_CHAPTER_CONTENT`
(`fixtures/projectModules/index.ts`), keyed `minor/chapter/language`. The minor
stays `planned` (admin preview only) until enough chapters are authored to launch.

Languages are Go, Python and C++. The learner picks a language inside a chapter; it
travels as `?lang=` and is remembered per minor.

## Chapters

| # | id | Status | Student focus | Author-owned (grows over time) |
| --- | --- | --- | --- | --- |
| 0 | `overview` | **ready** | reading only (`queryEngineOverview.ts`): pipeline, dialect, the plan | keep the chapter table in sync with `minors.ts` |
| 1 | `lexer` | **ready** (go, python, cpp) | 1.1 scan ident, 1.2 scan number/string, 1.3 scan symbol | token kinds, keyword table, `Scan` loop |
| 2 | `parser` | **ready** (go, python, cpp) | 2.1 AND/cmp, 2.2 primary/call, 2.3 SELECT | AST, parser cursor, from-tail / finish-select no-ops |
| 3 | `catalog` | **ready** (go, python, cpp) | 3.1 CREATE/INSERT parse, 3.2 Create, 3.3 Insert | in-memory `DB`, `Exec`, `Query` still refused |
| 4 | `execute` | **ready** (go, python, cpp) | 4.1 Scan.Next, 4.2 Eval, 4.3 Filter.Next, 4.4 Project.Next | `Iter`, `RunSelect` for one table, `Truth` |
| 5 | `relational` | **ready** (go, python, cpp) | 5.1 JOIN/tail parse, 5.2 NestedLoop.Next, 5.3 Aggregate, 5.4 SortRows | `HasAggregate`, `LimitRows`, full `RunSelect` |
| 6 | `benchmark` | planned | fixed SQL suite vs reference | placeholder until infra lands |

## Product name

The engine is **`sqlq`**. A REPL reads one statement at a time and prints rows.

```sql
CREATE TABLE users (id INT, name TEXT);
INSERT INTO users VALUES (1, 'ada');
SELECT name FROM users WHERE id = 1;
```

Public API the tests call (same shape in every language):

```go
db := sqlq.Open()
db.Exec(sql string) error          // CREATE, INSERT
rows, err := db.Query(sql string)  // SELECT
```

## Dialect (v1)

- Types: `INT`, `TEXT`. No nulls.
- Statements: `CREATE TABLE`, `INSERT INTO ... VALUES`, `SELECT`.
- `SELECT`: column list or `COUNT(*)` / `SUM(col)`, one `FROM` table or one `INNER JOIN` with `ON a = b`, optional `WHERE` of comparisons joined by `AND`, optional `GROUP BY`, `ORDER BY`, `LIMIT`.
- Identifiers are case-sensitive. Keywords are not.
- No subqueries, views, indexes, UPDATE, DELETE, OR, or functions beyond COUNT and SUM.

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
| Go | `github.com/devlabs/sqlq` (`internal/lex`, `internal/parse`, `internal/catalog`, `internal/exec`, `internal/sqlq`) |
| Python | `sqlq` (`sqlq/lex`, `sqlq/parse`, `sqlq/catalog`, `sqlq/execute`, `sqlq/sqlq.py`) |
| C++ | `src/lex`, `src/parse`, `src/catalog`, `src/execute`, `src/sqlq` |

Chapters 1–5 are registered in `queryEngineChaptersGo.ts`, `queryEngineChaptersPython.ts`, and `queryEngineChaptersCpp.ts`, which glob each `<chapter>/<lang>/files/**` (never `solution/`).

## Rules

Same as the other minors: scratch repos per chapter, `TODO(N.x)` markers, shared
`theory.md` with `<!-- lang: go -->` / `python` / `cpp` blocks, no hard wrapping, starters compile,
`solution/` never globbed into the bundle, learner-owned files stable across
later chapters (carry-forward via `utils/chapterCarry.ts`).

- Task ids, task count and test cases are the same in every language. A port
  changes syntax and idiom, never what the chapter teaches or checks.
- No third-party dependencies: Go stdlib, Python stdlib `unittest` (3.9+),
  C++17 with a plain Makefile and `tests/check.h`.

## Suggested package layout (chapter 5)

```
cmd/sqlq/…            // REPL
lex/                  // ch1
parse/                // ch2–5
catalog/              // ch3
execute/ or exec/     // ch4–5: scan, filter, project, join, agg, sort, limit
sqlq facade           // Open, Exec, Query
```

## Verifying a chapter

```bash
SRC=frontend/src/fixtures/projectModules/minors/query-engine/<chapter>
T=$(mktemp -d)
for L in go python cpp; do
  cp -R $SRC/$L/files $T/$L && cp -R $SRC/$L/solution/. $T/$L/
done
(cd $T/go && gofmt -l . && go vet ./... && make test && make race)
(cd $T/python && make test)
(cd $T/cpp && make test)
# AddressSanitizer hangs on recent macOS clang; run it in Linux instead:
docker run --rm -v "$T/cpp":/src -w /src gcc:13 make asan
```

Also run the starters (`files/` alone) and confirm every task's tests fail.
