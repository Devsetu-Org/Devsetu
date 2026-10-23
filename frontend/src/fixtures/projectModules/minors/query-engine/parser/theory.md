## Where you are
<!-- mode: read-only -->

The lexer hands you a list of tokens. The **parser** walks that list and builds a tree, the abstract syntax tree. A tree is easier to execute than a sentence: each node is one construct, and the children are its parts.

```plaintext
  SELECT name FROM users u WHERE id = 1 AND name > 'a'

  Select
    items: [ name ]
    from:  users   alias: u
    where: AND
             ├─ = (id, 1)
             └─ > (name, 'a')
```

This chapter parses `SELECT` only. `CREATE` and `INSERT` are next. Joins and `GROUP BY` come in the last chapter; the hooks for them are already in the parser and do nothing yet.

> [!scope] This chapter's job
> A SELECT with a target list, FROM, an optional alias, and an optional WHERE of comparisons
> joined by AND. A broken statement returns an error that names the byte offset.

## The grammar, in one picture
<!-- mode: read-only -->

```plaintext
  select    = SELECT item {',' item} FROM name [alias] [WHERE expr]
  item      = '*' | expr [AS name]
  alias     = [AS] name | empty
  expr      = cmp {AND cmp}
  cmp       = primary [('=' | '<' | '>') primary]
  primary   = int | string | name ['.' name] | COUNT '(' '*' | expr ')' | SUM '(' expr ')' | '(' expr ')'
```

`AND` binds looser than a comparison. `id = 1 AND name > 'a'` is `AND` of two comparisons, not a comparison whose sides contain `AND`. Parentheses call `parseExpr` again, so they can wrap either one.

`COUNT` and `SUM` are keywords, so a column cannot be named `count`. The call node is part of the tree now. Evaluating it is a later chapter.

<!-- lang: go -->
The node types are in `internal/parse/ast.go`. `Parser` (`peek`, `at`, `eat`, `expect`, `errorf`) and `Parse` are in `parser.go`. `parseFromTail` and `finishSelect` are given and return nil. You write `expr.go` and `select.go`. Your lexer from chapter 1 is already in `internal/lex`.
<!-- /lang -->

## Expressions
<!-- mode: read-and-implement tasks:2.1,2.2 -->

Recursive descent is one function per level of the grammar. The looser operator is the outer function. It calls the tighter one, and loops while it sees its own operator.

```plaintext
  parseAnd
    parseCmp
      parsePrimary
    AND
    parseCmp
      parsePrimary
```

A comparison that has no operator is just the primary. `SELECT name FROM t` has no `WHERE`, and a select item can be a bare name. Do not require an operator.

<!-- lang: go -->
### `TODO(2.1)` — `parseAnd` and `parseCmp`

In `internal/parse/expr.go`. `parseExpr` is already `return p.parseAnd()`.

`parseAnd`:

1. `left, err := p.parseCmp()`.
2. While `p.eat(lex.KwAnd)`, parse another comparison and set `left = &Binary{Op: "AND", L: left, R: right}`.
3. Return `left`.

`parseCmp`:

1. Parse a primary.
2. If the next token is `lex.Eq`, `lex.Lt`, or `lex.Gt`, consume it, parse another primary, and return `&Binary{Op: "=", "<", or ">", L: left, R: right}`.
3. Otherwise return the primary unchanged.

### `TODO(2.2)` — `parsePrimary` and `parseCall`

`parsePrimary` switches on the current token:

- `lex.Int`: `parseInt(t.Lit)` and return `&IntLit{V: n}`. A bad integer is `p.errorf("bad integer")`.
- `lex.String`: return `&StrLit{V: t.Lit}`.
- `lex.KwCount`: `return p.parseCall("count", true)`.
- `lex.KwSum`: `return p.parseCall("sum", false)`.
- `lex.Ident`: if the next token is `lex.Dot`, expect another ident and return `&Qual{Table: t.Lit, Name: col.Lit}`. Otherwise return `&Ident{Name: t.Lit}`.
- `lex.LParen`: parse an expression with `parseExpr`, expect `lex.RParen`, return the inner expression.
- Anything else: `p.errorf("expected an expression")`.

`parseCall(name, allowStar)`:

1. Consume `lex.KwCount` or `lex.KwSum` to match `name`.
2. Expect `(`.
3. When `allowStar` and the next token is `*`, expect `)` and return `&Call{Name: name, Star: true}`.
4. Otherwise parse an expression, expect `)`, and return `&Call{Name: name, Arg: arg}`.
<!-- /lang -->

## The SELECT statement
<!-- mode: read-and-implement tasks:2.3 -->

A statement is a list of items, a table, and an optional filter. The comma separates items. The alias is either `AS name` or a bare name, and it is absent when the next token is `WHERE`, a semicolon, or the end.

Call the two given hooks even though they do nothing. Chapter 5 fills them in without changing this file: `parseFromTail` will read a `JOIN` between the alias and `WHERE`, and `finishSelect` will read `GROUP BY`, `ORDER BY`, and `LIMIT`.

<!-- lang: go -->
### `TODO(2.3)` — `parseSelect`, `parseSelectItem`, `parseAlias`

In `internal/parse/select.go`.

`parseSelect`:

1. Expect `lex.KwSelect`.
2. Parse items with `parseSelectItem` until the next token is not a comma.
3. Expect `lex.KwFrom`, then an ident. That ident's `Lit` is `sel.From`.
4. `sel.Alias = p.parseAlias()`.
5. `p.parseFromTail(sel)`, then if `p.eat(lex.KwWhere)`, `sel.Where = p.parseExpr()`.
6. `p.finishSelect(sel)` and return `sel`.

`parseSelectItem`:

1. `*` returns `SelectItem{Star: true}`.
2. Otherwise parse an expression. If `p.eat(lex.KwAs)`, expect an ident and set `Alias`.

`parseAlias`:

1. If `AS`, expect an ident and return its `Lit`.
2. If the next token is an ident, take it and return its `Lit`.
3. Otherwise return `""`.
<!-- /lang -->

## Prove it
<!-- mode: read-only -->

<!-- lang: go -->
```bash
make test
make race
printf '%s\n' "SELECT name FROM users u WHERE id = 1;" | make run
```
<!-- /lang -->

The REPL prints the column count and the table name. `SELECT FROM t` fails: the grammar wants an item before `FROM`.

> [!check] Before you move on
> 1. `AND` is the outer expression. A comparison does not contain `AND`.
> 2. A missing operator is a bare primary, not an error.
> 3. `users u` and `users AS u` both set the alias. `WHERE` is not an alias.
> 4. `parseFromTail` and `finishSelect` are called and currently do nothing.

### What is missing

The tree describes a query. Nothing stores a table yet. Chapter 3 is the catalog: `CREATE TABLE` and `INSERT`, with `INT` and `TEXT` checked on the way in.
