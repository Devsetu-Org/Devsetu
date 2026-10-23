## Where you are
<!-- mode: read-only -->

The catalog holds tables. This chapter answers a single-table `SELECT` by pulling rows through a short pipeline.

```plaintext
  SELECT name FROM users WHERE id = 1

  Scan users  →  Filter (id = 1)  →  Project (name)  →  rows
```

Each box is an **iterator**. It has one method, `Next`, which returns the next row or says there are no more. The filter's child is the scan. The projection's child is the filter. Nobody builds a slice of the whole table until the end, and a filter drops a row before the projection ever sees it.

> [!scope] This chapter's job
> `SELECT` of a column list or `*` from one table, with an optional `WHERE` of `=`, `<`, `>`,
> and `AND`. No join, no aggregate, no sort. Those are the next chapter.

## Rows and expressions
<!-- mode: read-only -->

A scan names every column `table.column`, using the alias when the query gave one. `users u` produces `u.id` and `u.name`. `Get` finds a column by that exact name, or by the bare name when only one column has that suffix. `id` works. If a later join made `id` ambiguous, `Get` would refuse the bare name.

An expression evaluates against one row:

| Node | Result |
| --- | --- |
| integer literal | an `INT` |
| string literal | a `TEXT` |
| name or `table.name` | that cell, or an error when it is missing |
| `AND` | true when both sides are true. The right side is not evaluated when the left is false |
| `=`, `<`, `>` | a bool. The two sides must be the same type. Numbers compare as numbers, text as text |
| `COUNT` or `SUM` | an error. Aggregates are not row expressions |

<!-- lang: go -->
`Row`, `Get`, `Iter`, `Scan`, `NewScan`, `Filter`, and `Project` are in `internal/exec/row.go`. `Truth` is in `eval.go` and calls `Eval`; leave `Truth` as it is. `RunSelect` in `build.go` wires the pipeline and is given. You write `Scan.Next`, `Eval`, `Filter.Next`, and `Project.Next`.
<!-- /lang -->

## The scan
<!-- mode: read-and-implement tasks:4.1 -->

`NewScan` has already copied the table's rows and built the qualified column names. `Next` walks that copy. Return copies of the column slice and of the value slice, so a caller who mutates a row does not change the scan's state.

<!-- lang: go -->
### `TODO(4.1)` — `Scan.Next`

In `internal/exec/scan.go`:

1. When `s.i >= len(s.Rows)`, return `Row{}, false, nil`.
2. Copy `s.Rows[s.i]` with `append([]catalog.Value(nil), ...)`, then increment `s.i`.
3. Return `Row{Cols: append([]string(nil), s.Cols...), Vals: vals}, true, nil`.
<!-- /lang -->

## The filter
<!-- mode: read-and-implement tasks:4.2,4.3 -->

`Eval` turns an expression and a row into a value. `Filter.Next` asks its child for rows and keeps the ones whose predicate is true. A predicate error fails the query. It is not a false result.

<!-- lang: go -->
### `TODO(4.2)` — `Eval`

In `internal/exec/eval.go`. Switch on the expression:

- `*parse.IntLit` → `catalog.Int(v.V)`. `*parse.StrLit` → `catalog.Text(v.V)`.
- `*parse.Ident` → `row.Get(v.Name)`. `*parse.Qual` → `row.Get(v.Table + "." + v.Name)`, then `row.Get(v.Name)` if the qualified name misses. Missing is an error.
- `*parse.Binary` with `Op == "AND"`: eval the left side. When it is bool and false, return `catalog.Bool(false)` without evaluating the right side. Otherwise the result is the right side, which must be bool.
- `*parse.Binary` with `=`, `<`, or `>`: eval both sides. Reject different types. Compare `I` for `INT` and `S` for `TEXT`. Return `catalog.Bool`.
- `*parse.Call`: return an error. Aggregates are not evaluated here.

### `TODO(4.3)` — `Filter.Next`

In `internal/exec/filter.go`:

1. Loop. `row, ok, err := f.Child.Next()`.
2. On an error, or when `ok` is false, return that triple.
3. `keep, err := f.Pred(row)`. An error fails the filter.
4. When `keep` is true, return the row. Otherwise pull again.
<!-- /lang -->

## The projection
<!-- mode: read-and-implement tasks:4.4 -->

The projection turns one input row into one output row. The given `project` helper in `build.go` evaluates each select item, uses the alias when there is one, and expands `*`. `Project.Next` only has to pull a child row and call `Pick`.

<!-- lang: go -->
### `TODO(4.4)` — `Project.Next`

In `internal/exec/project.go`:

1. Pull one child row. Pass through a finished child or an error.
2. `out, err := p.Pick(row)`. On error return `Row{}, false, err`.
3. Return `out, true, nil`.
<!-- /lang -->

`RunSelect` looks up the table, scans it under the alias (or the table name), wraps a `Filter` when there is a `WHERE`, then projects. `Query` on `sqlq.DB` calls it.

## Prove it
<!-- mode: read-only -->

<!-- lang: go -->
```bash
make test
make race
make run
```
<!-- /lang -->

```sql
CREATE TABLE users (id INT, name TEXT);
INSERT INTO users VALUES (1, 'ada'), (2, 'bea');
SELECT name FROM users WHERE id = 1;
```

That returns one row, `ada`. `SELECT id FROM users WHERE id > 1 AND name < 'cy'` returns `2`.

> [!check] Before you move on
> 1. A scan yields every row, in insert order, with qualified column names.
> 2. `AND` does not evaluate its right side when the left side is false.
> 3. A filter drops rows. A projection drops columns. Neither changes the other.
> 4. `COUNT` and `SUM` still fail here. They need a group, not a row.

### What is missing

Two tables, and a question that counts. Chapter 5 adds an inner join, `GROUP BY`, `COUNT` and `SUM`, `ORDER BY`, and `LIMIT`. The scan, filter, and projection stay exactly the files you wrote here.
