## Where you are
<!-- mode: read-only -->

A query names tables. The **catalog** is the list of those tables: each has a name, an ordered list of columns, and the rows inserted so far. This engine keeps that list in memory. There is no file and no index.

```plaintext
  CREATE TABLE users (id INT, name TEXT);
  INSERT INTO users VALUES (1, 'ada'), (2, 'bea');

  users
  ┌────┬──────┐
  │ id │ name │
  │ 1  │ ada  │
  │ 2  │ bea  │
  └────┴──────┘
```

Creating the same table twice is an error. Inserting a string into an `INT` column is an error. Inserting three values into a two-column table is an error. The catalog is where those mistakes stop, before any query runs.

> [!scope] This chapter's job
> Parse `CREATE TABLE` and `INSERT`, and store rows that match the schema. `SELECT` still
> does not return rows. That is the next chapter.

## A table is a schema plus rows
<!-- mode: read-only -->

Every column is `INT` or `TEXT`. There are no nulls, so every cell of an inserted row has a value, and the value's type is the column's type. Column order is the order written in `CREATE TABLE`. `INSERT` does not take a column list; values line up left to right.

Names are case-sensitive. `Users` and `users` are different tables. Keywords are still case-insensitive, which the lexer already handled.

<!-- lang: go -->
`catalog.DB`, `Table`, `Col`, and `Value` are in `internal/catalog/catalog.go`. `Lookup` is given. You write `Create` and `Insert` in `mutate.go`.

The parser grew a `CREATE` and `INSERT` arm. The statement nodes (`CreateTable`, `Insert`, `Column`) were already in `ast.go`. You write `parseCreate` and `parseInsert` in `internal/parse/ddl.go`. `parseInt` is given, on the parser.
<!-- /lang -->

## Parsing the statements
<!-- mode: read-and-implement tasks:3.1 -->

```plaintext
  create = CREATE TABLE name '(' name type {',' name type} ')'
  type   = INT | TEXT
  insert = INSERT INTO name VALUES '(' primary {',' primary} ')' {',' '(' primary {',' primary} ')'}
```

An insert value is a primary, not a full expression: a number, a string, or a parenthesized primary. `1+2` is not a value. There is no arithmetic in this dialect.

<!-- lang: go -->
### `TODO(3.1)` — `parseCreate`, `parseType`, `parseInsert`

In `internal/parse/ddl.go`.

`parseCreate`:

1. Expect `CREATE`, `TABLE`, an ident, and `(`.
2. Repeat: expect an ident, parse a type, append `Column{Name: col.Lit, Type: typ}`. A comma continues the list.
3. Expect `)`.

`parseType`: `INT` returns `TypeInt`, `TEXT` returns `TypeText`, anything else is `p.errorf("expected INT or TEXT")`.

`parseInsert`:

1. Expect `INSERT`, `INTO`, an ident, and `VALUES`.
2. Repeat a parenthesized row. Each cell is `p.parsePrimary()`. Commas separate cells, and commas between `)` and `(` separate rows.
3. Append each row to `ins.Rows`.
<!-- /lang -->

## Storing rows
<!-- mode: read-and-implement tasks:3.2,3.3 -->

`Create` records the schema and zero rows. `Insert` appends one row after checking the shape. Copy the slices you store. Callers reuse the slices they pass in, and a later mutation of the input must not change the table.

<!-- lang: go -->
### `TODO(3.2)` — `Create`

In `internal/catalog/mutate.go`:

1. An empty name, or `len(cols) == 0`, is an error.
2. `db.tables[name]` already set means the table exists.
3. Walk `cols`. An empty `Name`, or a name already seen in this list, is an error.
4. Store `&Table{Name: name, Cols: append([]Col(nil), cols...)}`.

### `TODO(3.3)` — `Insert`

1. `db.Lookup(name)`. A missing table is that error.
2. `len(row)` must equal `len(t.Cols)`.
3. For each column, `row[i].T` must equal `c.Type`. Say which column was wrong.
4. Append `append([]Value(nil), row...)` to `t.Rows`.
<!-- /lang -->

The public `Exec` path parses, maps `INT` and `TEXT` onto `catalog.TypeInt` and `catalog.TypeText`, and calls `Create` or `Insert`. `Query` returns an error until the executor exists. You do not need to change that wiring.

## Prove it
<!-- mode: read-only -->

<!-- lang: go -->
```bash
make test
make race
make run
```
<!-- /lang -->

In the REPL, end each statement with `;`:

```sql
CREATE TABLE users (id INT, name TEXT);
INSERT INTO users VALUES (1, 'ada');
INSERT INTO users VALUES ('nope', 'x');
```

The last insert fails. The table still holds `ada`.

> [!check] Before you move on
> 1. A table name and a column name are unique within their scope.
> 2. An inserted row has one cell per column, and the cell type matches.
> 3. Stored slices are copies. The caller's slice is not the table's slice.
> 4. `SELECT` parses and then refuses to run. Rows come back in the next chapter.

### What is missing

The catalog can hold `users`. It cannot answer `SELECT name FROM users WHERE id = 1`. Chapter 4 is the executor: a scan, a filter, and a projection.
