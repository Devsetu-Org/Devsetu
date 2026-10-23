# Query engine minor — authoring model

A chaptered minor: `constants/minors.ts` lists the chapters, and each `ready`
chapter has a fixture per language registered in `MINOR_CHAPTER_CONTENT`
(`fixtures/projectModules/index.ts`), keyed `minor/chapter/language`. The minor
stays `planned` (admin preview only) until enough chapters are authored to launch.

Languages start with Go only. The learner picks a language inside a chapter; it
travels as `?lang=` and is remembered per minor.

## Chapters

| # | id | Status | Student focus | Author-owned (grows over time) |
| --- | --- | --- | --- | --- |
| 0 | `overview` | **ready** | reading only (`queryEngineOverview.ts`): pipeline, dialect, the plan | keep the chapter table in sync with `minors.ts` |
| 1 | `lexer` | **ready** (Go) | 1.1 `scanIdent`, 1.2 `scanNumber`/`scanString`, 1.3 `scanSymbol` (`lex/scan.go`) | token kinds, keyword table, `Scan` loop |
| 2 | `parser` | **ready** (Go) | 2.1 `parseAnd`/`parseCmp`, 2.2 `parsePrimary`/`parseCall` (`parse/expr.go`); 2.3 `parseSelect` (`parse/select.go`) | AST, `Parser` cursor, `parseFromTail`/`finishSelect` no-ops |
| 3 | `catalog` | **ready** (Go) | 3.1 `parseCreate`/`parseInsert` (`parse/ddl.go`); 3.2 `Create`, 3.3 `Insert` (`catalog/mutate.go`) | in-memory `DB`, `Exec`, `Query` still refused |
| 4 | `execute` | **ready** (Go) | 4.1 `Scan.Next`, 4.2 `Eval`, 4.3 `Filter.Next`, 4.4 `Project.Next` | `Iter`, `RunSelect` for one table, `Truth` |
| 5 | `relational` | **ready** (Go) | 5.1 `parseJoin`/`parseTail`; 5.2 `NestedLoop.Next`; 5.3 `Aggregate`; 5.4 `SortRows` | `HasAggregate`, `LimitRows`, full `RunSelect` |
| 6 | `benchmark` | planned | fixed SQL suite vs reference | placeholder until infra lands |

## Product name

The engine is **`sqlq`**. A REPL reads one statement at a time and prints rows.

```sql
CREATE TABLE users (id INT, name TEXT);
INSERT INTO users VALUES (1, 'ada');
SELECT name FROM users WHERE id = 1;
```

Go API the tests call:

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
  theory.md
  go/files/            starter repo      go/solution/      edited files only
```

Module path: `github.com/devlabs/sqlq`.

## Rules

Same as the other minors: scratch repos per chapter, `TODO(N.x)` markers, shared
`theory.md` with `<!-- lang: go -->` blocks, no hard wrapping, starters compile,
`solution/` never globbed into the bundle, learner-owned files stable across
later chapters (carry-forward via `utils/chapterCarry.ts`).

## Suggested Go package layout (chapter 5)

```
cmd/sqlq/main.go
internal/lex/         // ch1
internal/parse/       // ch2
internal/catalog/     // ch3
internal/exec/        // ch4–5: scan, filter, project, join, agg, sort, limit
internal/sqlq/        // Open, Exec, Query
```

## Verifying a chapter

```bash
gofmt -l .
go vet ./...
go test -race -count=1 ./...
```
