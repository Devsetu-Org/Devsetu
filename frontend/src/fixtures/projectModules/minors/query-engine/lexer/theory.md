## Where you are
<!-- mode: read-only -->

A query engine never works on raw characters. The first stage, the **lexer**, walks the SQL string once and emits **tokens**: a keyword, a name, a number, a string, or one piece of punctuation.

```plaintext
  SELECT name FROM users WHERE id = 1;
        │
        ▼
  select · ident(name) · from · ident(users) · where · ident(id) · eq · int(1) · semicolon
```

Whitespace disappears. The parser in the next chapter only sees this list.

> [!scope] This chapter's job
> Only the scanner. No grammar, no tables, no rows. When you finish, `Scan` turns a statement
> into tokens and rejects a character the dialect does not use.

## Tokens
<!-- mode: read-only -->

### One token is one meaningful piece

`id` is one identifier, not the letters `i` and `d`. `42` is one integer. `'ada'` is one string, and the quotes are not part of the value. `=` is one operator. `SELECT` is a keyword even when the user typed `SeLeCt`.

Keywords are case-insensitive. Identifiers are not: `Name` and `name` are different columns. The token keeps the original spelling in `Lit`, and the kind says whether that spelling is a keyword.

```plaintext
  SeLeCt     kind = select,  lit = "SeLeCt"
  name       kind = ident,   lit = "name"
  'a''b'     kind = string,  lit = "a'b"      two quotes in a row are one quote
  10         kind = int,     lit = "10"
```

A string that never closes, or a character such as `@`, is an error. The error points at the byte offset where the scan went wrong.

<!-- lang: go -->
The token kinds, the keyword table, and `Keyword` live in `internal/lex/token.go`. The cursor (`peek`, `bump`, `skipSpace`) lives in `lex.go`. You fill in the four methods in `scan.go`. `Scan` calls them; do not change `Scan`.
<!-- /lang -->
<!-- lang: python -->
The token kinds, the keyword table, and `keyword` live in `sqlq/lex/token.py`. The cursor (`peek`, `bump`, `skip_space`) lives in `lex.py`. You fill in the four functions in `scan.py`. `Scan` calls them; do not change `Scan`.
<!-- /lang -->
<!-- lang: cpp -->
The token kinds, the keyword table, and `Keyword` live in `src/lex/token.h`. The cursor (`Peek`, `Bump`, `SkipSpace`) lives in `lex.cc`. You fill in the four functions in `scan.cc`. `Scan` calls them; do not change `Scan`.
<!-- /lang -->

## Identifiers and keywords
<!-- mode: read-and-implement tasks:1.1 -->

An identifier starts with a letter or `_` and continues with letters, digits, or `_`. The caller has already checked the first character, so you only have to read the rest.

After you have the spelling, ask the keyword table. `FROM` becomes the keyword `from`. `fromage` stays an identifier, because the table matches the whole word, not a prefix.

<!-- lang: go -->
### `TODO(1.1)` — `scanIdent`

In `internal/lex/scan.go`:

1. Remember `start := s.i`.
2. While `!s.eof()` and `isIdentPart(s.peek())`, call `s.bump()`.
3. `lit := s.src[start:s.i]`.
4. Return `Token{Kind: Keyword(lit), Lit: lit, Pos: start}`.

`Keyword` lower-cases the word for the lookup and returns `Ident` when it is not a keyword. Leave `Lit` in the original case.
<!-- /lang -->
<!-- lang: python -->
### `TODO(1.1)` — `scan_ident`

In `sqlq/lex/scan.py`:

1. Remember `start = s.i`.
2. While `not s.eof()` and `is_ident_part(s.peek())`, call `s.bump()`.
3. `lit = s.src[start:s.i]`.
4. Return `Token(kind=keyword(lit), lit=lit, pos=start)`.

`keyword` lower-cases the word for the lookup and returns `Ident` when it is not a keyword. Leave `lit` in the original case.
<!-- /lang -->
<!-- lang: cpp -->
### `TODO(1.1)` — `ScanIdent`

In `src/lex/scan.cc`:

1. Remember `start = s.i_`.
2. While `!s.Eof()` and `IsIdentPart(s.Peek())`, call `s.Bump()`.
3. `lit = s.src_.substr(start, s.i_ - start)`.
4. Return `Token{Keyword(lit), lit, start}`.

`Keyword` lower-cases the word for the lookup and returns `kIdent` when it is not a keyword. Leave `lit` in the original case.
<!-- /lang -->

## Numbers and strings
<!-- mode: read-and-implement tasks:1.2 -->

Integers are a run of digits. There is no sign and no decimal point. `-1` is not one token in this dialect; you will not need it.

Strings use single quotes. The opening quote is already under the cursor. Two quotes in a row are an escaped quote, the way SQL writes `O''Brien`. A newline or the end of the input inside a string is an unterminated string, not a guess at where the quote should have been.

```plaintext
  'a''b'     contents a'b
  'hello     error: unterminated string
  'ab
  c'         error: unterminated string
```

<!-- lang: go -->
### `TODO(1.2)` — `scanNumber` and `scanString`

`scanNumber`:

1. Remember `start`. Read while `isDigit(s.peek())`.
2. Return `Token{Kind: Int, Lit: s.src[start:s.i], Pos: start}`.

`scanString`:

1. Remember `start`, then `bump` past the opening `'`.
2. Collect characters into a `[]byte`. `bump` returns the next byte.
3. A newline returns `&Error{Pos: start, Msg: "unterminated string"}`.
4. A `'` followed by another `'` appends one `'` and continues. A `'` that is not doubled ends the string: return `Token{Kind: String, Lit: string(b), Pos: start}`.
5. Reaching EOF before the closing quote is the same unterminated-string error.
<!-- /lang -->
<!-- lang: python -->
### `TODO(1.2)` — `scan_number` and `scan_string`

`scan_number`:

1. Remember `start`. Read while `is_digit(s.peek())`.
2. Return `Token(kind=Int, lit=s.src[start:s.i], pos=start)`.

`scan_string`:

1. Remember `start`, then `bump` past the opening `'`.
2. Collect characters into a list. `bump` returns the next character.
3. A newline raises `LexError(start, "unterminated string")`.
4. A `'` followed by another `'` appends one `'` and continues. A `'` that is not doubled ends the string: return `Token(kind=String, lit=''.join(b), pos=start)`.
5. Reaching EOF before the closing quote is the same unterminated-string error.
<!-- /lang -->
<!-- lang: cpp -->
### `TODO(1.2)` — `ScanNumber` and `ScanString`

`ScanNumber`:

1. Remember `start`. Read while `IsDigit(s.Peek())`.
2. Return `Token{Kind::kInt, s.src_.substr(start, s.i_ - start), start}`.

`ScanString`:

1. Remember `start`, then `Bump` past the opening `'`.
2. Collect characters into a `std::string`. `Bump` returns the next byte.
3. A newline throws `Error(start, "unterminated string")`.
4. A `'` followed by another `'` appends one `'` and continues. A `'` that is not doubled ends the string: return `Token{Kind::kString, b, start}`.
5. Reaching EOF before the closing quote is the same unterminated-string error.
<!-- /lang -->

## Punctuation
<!-- mode: read-and-implement tasks:1.3 -->

Everything else is one character. The dialect uses `* , ( ) = < > ; .` and nothing more. `<=` is not an operator here; `<` and `=` would be two tokens, and the parser will reject that combination later.

<!-- lang: go -->
### `TODO(1.3)` — `scanSymbol`

`bump` one byte and map it:

| Character | Kind |
| --- | --- |
| `*` | `Star` |
| `,` | `Comma` |
| `(` | `LParen` |
| `)` | `RParen` |
| `=` | `Eq` |
| `<` | `Lt` |
| `>` | `Gt` |
| `;` | `Semicolon` |
| `.` | `Dot` |

Anything else returns `&Error{Pos: pos, Msg: "unexpected character"}`. Set `Lit` to `string(c)` and `Pos` to the index from before the bump.
<!-- /lang -->
<!-- lang: python -->
### `TODO(1.3)` — `scan_symbol`

`bump` one character and map it:

| Character | Kind |
| --- | --- |
| `*` | `Star` |
| `,` | `Comma` |
| `(` | `LParen` |
| `)` | `RParen` |
| `=` | `Eq` |
| `<` | `Lt` |
| `>` | `Gt` |
| `;` | `Semicolon` |
| `.` | `Dot` |

Anything else raises `LexError(pos, "unexpected character")`. Set `lit` to the character and `pos` to the index from before the bump.
<!-- /lang -->
<!-- lang: cpp -->
### `TODO(1.3)` — `ScanSymbol`

`Bump` one byte and map it:

| Character | Kind |
| --- | --- |
| `*` | `kStar` |
| `,` | `kComma` |
| `(` | `kLParen` |
| `)` | `kRParen` |
| `=` | `kEq` |
| `<` | `kLt` |
| `>` | `kGt` |
| `;` | `kSemicolon` |
| `.` | `kDot` |

Anything else throws `Error(pos, "unexpected character")`. Set `lit` to a one-character string and `pos` to the index from before the bump.
<!-- /lang -->

## Prove it
<!-- mode: read-only -->

<!-- lang: go -->
```bash
make test
make race
printf '%s\n' "SELECT name FROM users WHERE id = 1;" | make run
```
<!-- /lang -->
<!-- lang: python -->
```bash
make test
printf '%s\n' "SELECT name FROM users WHERE id = 1;" | make run
```
<!-- /lang -->
<!-- lang: cpp -->
```bash
make test
printf '%s\n' "SELECT name FROM users WHERE id = 1;" | make run
```
<!-- /lang -->

The REPL prints one token per line: the kind, and the literal when the token is a name, a number, or a string. Keywords print as their kind only.

> [!check] Before you move on
> 1. Whitespace is gone. The parser never sees a space.
> 2. Keywords are case-insensitive. Identifier spelling is preserved.
> 3. `''` inside a string is one quote character. A newline inside a string is an error.
> 4. An unknown character fails the scan. It does not become an identifier.

### What is missing

Tokens do not know that `SELECT` must be followed by a column list. Chapter 2 is the parser: it walks this list and builds a tree, and it rejects a statement whose shape is wrong.
