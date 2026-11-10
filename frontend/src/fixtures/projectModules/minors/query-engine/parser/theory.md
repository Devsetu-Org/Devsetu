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
<!-- lang: python -->
The node types are in `sqlq/parse/ast.py`. `Parser` (`peek`, `at`, `eat`, `expect`, `errorf`) and `Parse` are in `parser.py`. `parse_from_tail` and `finish_select` are given and return None. You write `expr.py` and `select.py`. Your lexer from chapter 1 is already in `sqlq/lex`.
<!-- /lang -->
<!-- lang: cpp -->
The node types are in `src/parse/ast.h`. `Parser` (`Peek`, `At`, `Eat`, `Expect`, `Errorf`) and `Parse` are in `parser.cc`. `ParseFromTail` and `FinishSelect` are given and return without doing work. You write `expr.cc` and `select.cc`. Your lexer from chapter 1 is already in `src/lex`.
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
<!-- lang: python -->
### `TODO(2.1)` — `parse_and` and `parse_cmp`

In `sqlq/parse/expr.py`. `parse_expr` is already `return parse_and(p)`.

`parse_and`:

1. `left = parse_cmp(p)`.
2. While `p.eat(KwAnd)`, parse another comparison and set `left = Binary(op="AND", left=left, right=right)`.
3. Return `left`.

`parse_cmp`:

1. Parse a primary.
2. If the next token is `Eq`, `Lt`, or `Gt`, consume it, parse another primary, and return `Binary(op="=", "<", or ">", left=left, right=right)`.
3. Otherwise return the primary unchanged.

### `TODO(2.2)` — `parse_primary` and `parse_call`

`parse_primary` switches on the current token:

- `Int`: `parse_int(t.lit)` and return `IntLit(v=n)`. A bad integer is `p.errorf("bad integer")`.
- `String`: return `StrLit(v=t.lit)`.
- `KwCount`: `return parse_call(p, "count", True)`.
- `KwSum`: `return parse_call(p, "sum", False)`.
- `Ident`: if the next token is `Dot`, expect another ident and return `Qual(table=t.lit, name=col.lit)`. Otherwise return `Ident(name=t.lit)`.
- `LParen`: parse an expression with `parse_expr`, expect `RParen`, return the inner expression.
- Anything else: `p.errorf("expected an expression")`.

`parse_call(p, name, allow_star)`:

1. Consume `KwCount` or `KwSum` to match `name`.
2. Expect `(`.
3. When `allow_star` and the next token is `*`, expect `)` and return `Call(name=name, star=True)`.
4. Otherwise parse an expression, expect `)`, and return `Call(name=name, arg=arg)`.
<!-- /lang -->
<!-- lang: cpp -->
### `TODO(2.1)` — `ParseAnd` and `ParseCmp`

In `src/parse/expr.cc`. `ParseExpr` is already `return ParseAnd(p)`.

`ParseAnd`:

1. `left = ParseCmp(p)`.
2. While `p.Eat(kKwAnd)`, parse another comparison and set `left` to a new `Binary{"AND", left, right}`.
3. Return `left`.

`ParseCmp`:

1. Parse a primary.
2. If the next token is `kEq`, `kLt`, or `kGt`, consume it, parse another primary, and return a `Binary`.
3. Otherwise return the primary unchanged.

### `TODO(2.2)` — `ParsePrimary` and `ParseCall`

`ParsePrimary` switches on the current token:

- `kInt`: `ParseInt(t.lit)` and return `IntLit`. A bad integer is `p.Errorf("bad integer")`.
- `kString`: return `StrLit`.
- `kKwCount`: `return ParseCall(p, "count", true)`.
- `kKwSum`: `return ParseCall(p, "sum", false)`.
- `kIdent`: if the next token is `kDot`, expect another ident and return `Qual`. Otherwise return `Ident`.
- `kLParen`: parse an expression with `ParseExpr`, expect `kRParen`, return the inner expression.
- Anything else: `p.Errorf("expected an expression")`.

`ParseCall(p, name, allow_star)`:

1. Consume `kKwCount` or `kKwSum` to match `name`.
2. Expect `(`.
3. When `allow_star` and the next token is `*`, expect `)` and return a `Call` with `star` true.
4. Otherwise parse an expression, expect `)`, and return a `Call` with that argument.
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
<!-- lang: python -->
### `TODO(2.3)` — `parse_select`, `parse_select_item`, `parse_alias`

In `sqlq/parse/select.py`.

`parse_select`:

1. Expect `KwSelect`.
2. Parse items with `parse_select_item` until the next token is not a comma.
3. Expect `KwFrom`, then an ident. That ident's `lit` is `sel.from_table`.
4. `sel.alias = parse_alias(p)`.
5. `p.parse_from_tail(sel)`, then if `p.eat(KwWhere)`, `sel.where = parse_expr(p)`.
6. `p.finish_select(sel)` and return `sel`.

`parse_select_item`:

1. `*` returns `SelectItem(star=True)`.
2. Otherwise parse an expression. If `p.eat(KwAs)`, expect an ident and set `alias`.

`parse_alias`:

1. If `AS`, expect an ident and return its `lit`.
2. If the next token is an ident, take it and return its `lit`.
3. Otherwise return `""`.
<!-- /lang -->
<!-- lang: cpp -->
### `TODO(2.3)` — `ParseSelect`, `ParseSelectItem`, `ParseAlias`

In `src/parse/select.cc`.

`ParseSelect`:

1. Expect `kKwSelect`.
2. Parse items with `ParseSelectItem` until the next token is not a comma.
3. Expect `kKwFrom`, then an ident. That ident's `lit` is `sel->from`.
4. `sel->alias = ParseAlias(p)`.
5. `p.ParseFromTail(sel.get())`, then if `p.Eat(kKwWhere)`, `sel->where = ParseExpr(p)`.
6. `p.FinishSelect(sel.get())` and return `sel`.

`ParseSelectItem`:

1. `*` returns a `SelectItem` with `star` true.
2. Otherwise parse an expression. If `p.Eat(kKwAs)`, expect an ident and set `alias`.

`ParseAlias`:

1. If `AS`, expect an ident and return its `lit`.
2. If the next token is an ident, take it and return its `lit`.
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
<!-- lang: python -->
```bash
make test
printf '%s\n' "SELECT name FROM users u WHERE id = 1;" | make run
```
<!-- /lang -->
<!-- lang: cpp -->
```bash
make test
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
