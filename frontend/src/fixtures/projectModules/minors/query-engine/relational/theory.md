## Where you are
<!-- mode: read-only -->

A single-table filter is the core of the pipeline. This chapter adds the operators that combine tables and collapse rows.

```plaintext
  SELECT u.name, COUNT(*) AS n
  FROM users u JOIN orders o ON u.id = o.user_id
  WHERE o.total > 10
  GROUP BY u.name
  ORDER BY n DESC
  LIMIT 1

  Scan users
    → Nested-loop join orders
    → Filter total > 10
    → Aggregate by name
    → Sort
    → Limit
```

The join runs before the filter, because `WHERE` can mention columns from either table. Aggregation replaces the projection: the output is one row per group, not one row per input. Sort and limit run on that output.

> [!scope] This chapter's job
> One `INNER JOIN` with `ON a = b`, `COUNT(*)`, `SUM`, `GROUP BY`, `ORDER BY`, and `LIMIT`.
> Still no outer join, no `OR`, and no second join.

## The clauses the parser skipped
<!-- mode: read-and-implement tasks:5.1 -->

Chapter 2 left two hooks empty. They are live now. `parseFromTail` calls `parseJoin` when it sees `INNER` or `JOIN`, between the table alias and `WHERE`. `finishSelect` calls `parseTail` after `WHERE`.

```plaintext
  [INNER] JOIN name [alias] ON primary = primary
  [GROUP BY expr {',' expr}]
  [ORDER BY expr [ASC | DESC] {',' expr}]
  [LIMIT int]
```

A query with none of these still parses. `parseTail` returns immediately when the next token is not `GROUP`, `ORDER`, or `LIMIT`, which is why the earlier tests keep passing while this function is unfinished.

<!-- lang: go -->
### `TODO(5.1)` — `parseTail` and `parseJoin`

In `internal/parse/tail.go`. The panic in `parseTail` is the stand-in; replace the whole function.

`parseJoin`:

1. `p.eat(lex.KwInner)` when it is there. Then expect `JOIN` and an ident.
2. `Alias` is `p.parseAlias()`.
3. Expect `ON`, parse a primary, expect `=`, parse a primary.
4. Return `&Join{Table, Alias, Left, Right}`.

`parseTail`:

1. On `GROUP`, expect `BY`, then expressions separated by commas, appended to `s.Group`.
2. On `ORDER`, expect `BY`. Each key is an expression, then an optional `ASC` or `DESC`. `DESC` sets `OrderKey.Desc`. Append to `s.Order`.
3. On `LIMIT`, expect an int, `parseInt`, and set `s.Limit` to a pointer to that value.
4. Return nil when the clause is absent. Do not require the clauses to appear.
<!-- /lang -->

## Nested-loop join
<!-- mode: read-and-implement tasks:5.2 -->

An inner join keeps pairs that match. The nested loop is the straightforward version: for each row on the left, try every row on the right. The right-hand table is scanned once up front (it is small, and it is in memory). The left side stays an iterator, so a filter under the join is not forced to materialize early. In `RunSelect` the filter is above the join, which matches `WHERE`.

A joined row is the left columns followed by the right columns. `u.id` and `o.user_id` are both present, so `ON u.id = o.user_id` evaluates against the combined row.

<!-- lang: go -->
### `TODO(5.2)` — `NestedLoop.Next`

The struct and `NewNestedLoop` are in `internal/exec/join.go`. Fill in `Next`.

1. When you need a new left row (`primed` is false, or `rj` is past the right side), pull `n.Left.Next()`. A finished left side finishes the join. Store the row, set `rj` to 0, set `primed`.
2. If the right side is empty, loop and pull the next left row.
3. Take `n.Right[n.rj]`, increment `rj`, and concatenate columns and values. Copy the slices.
4. `Eval` `n.OnL` and `n.OnR` on the combined row. When the types match and the values match (`I`, `S`, or `B`), return the combined row. Otherwise try the next right row.

`RunSelect` builds this only when `sel.Join` is set. It qualifies the right table with its alias.
<!-- /lang -->

## COUNT and SUM
<!-- mode: read-and-implement tasks:5.3 -->

`HasAggregate` is given, in `build.go`. It is true when the query has a `GROUP BY` or any select item is a call. Those queries go through `Aggregate` instead of `Project`.

Rows in a group share the `GROUP BY` values. The group key is `strings.Join` of each value's `String()`, separated by a NUL byte (`"\x00"`), so two groups cannot collide. With no `GROUP BY`, every row is one group and the key can be empty.

`COUNT(*)` is how many input rows fell into the bucket. `SUM(expr)` adds the integer value of `expr` on each of those rows. A group column in the select list is taken from any row of the bucket; they are equal by construction.

No input rows and no `GROUP BY` still produces one row. `SUM` of nothing is 0, and `COUNT(*)` of nothing is 0. That is what `SELECT SUM(total) FROM orders` returns on an empty table. With `GROUP BY`, an empty input produces no groups.

<!-- lang: go -->
### `TODO(5.3)` — `Aggregate`

In `internal/exec/agg.go`:

1. For each input row, build a key from `group`. A missing column is an error. Create the bucket on first sight and remember key order, so output follows the first time a group was seen.
2. Increment the count. For each select item that is `*parse.Call` named `"sum"` and not `Star`, `Eval` the argument and add it. `SUM` of a non-integer is an error.
3. When `rows` is empty and `group` is empty, keep a single empty bucket so one output row still appears.
4. For each bucket, build an output row. A `count` call becomes `catalog.Int(count)`. A `sum` call becomes the sum, or 0 when the bucket never added it. Any other item is evaluated against the bucket's first row. `*` in an aggregate list is an error.
5. The output column name is the alias, or `parse.Name(item.Expr)` when there is no alias. `parse.Name` of `COUNT(*)` is `count(*)`, and of `SUM(total)` is `sum(total)`.
<!-- /lang -->

## Order and limit
<!-- mode: read-and-implement tasks:5.4 -->

`ORDER BY` names an output column, not an input column. `ORDER BY n` works when the select item was `COUNT(*) AS n`. With no alias, `ORDER BY count(*)` matches `parse.Name` of that call. The sort is stable: rows that compare equal stay in the order they were produced.

`LimitRows` is already written. `RunSelect` calls it when `sel.Limit` is set.

<!-- lang: go -->
### `TODO(5.4)` — `SortRows`

In `internal/exec/sort.go`:

1. For each key, the column name is `parse.Name(k.Expr)`. When the expression is an `*parse.Ident`, use `id.Name` instead, so a qualified-looking name is not required.
2. Find that name in `rows[0].Cols`. Also accept `parse.Name(k.Expr)` as a second spelling. Missing, when there is at least one row, is an error. Zero rows is success: there is nothing to sort.
3. `sort.SliceStable`. Compare values with integers on `I` and text on `S`. `Desc` flips the comparison. A zero comparison falls through to the next key.
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

```sql
CREATE TABLE users (id INT, name TEXT);
INSERT INTO users VALUES (1, 'ada'), (2, 'bea'), (3, 'cy');
CREATE TABLE orders (id INT, user_id INT, total INT);
INSERT INTO orders VALUES (1, 1, 5), (2, 1, 20), (3, 2, 15);

SELECT u.name, COUNT(*) AS n
FROM users u JOIN orders o ON u.id = o.user_id
WHERE o.total > 10
GROUP BY u.name
ORDER BY n DESC
LIMIT 1;
```

One row: `ada` and `1`. `bea` has an order over 10 as well, and `ada` sorts first because the counts tie and `ada`'s group was seen first. `SELECT SUM(total) FROM orders` is `40`.

> [!check] Before you move on
> 1. `JOIN` is parsed before `WHERE`. The filter sees columns from both tables.
> 2. The join returns only pairs whose `ON` values are equal. Unmatched left rows disappear.
> 3. `COUNT(*)` counts input rows in the group. An empty table with no `GROUP BY` yields one row of zeros.
> 4. `ORDER BY` refers to an output name. `LIMIT` cuts after the sort.

### What is missing

The engine runs the plan the SQL spelled out. It does not choose a different plan. There is no index, no hash join, and no cost model. The benchmark chapter, when it lands, will time this pipeline against a reference on a fixed set of queries. Correct answers come first.
