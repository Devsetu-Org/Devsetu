## Where you are
<!-- mode: read-only -->

A shell never starts a process from raw characters. The first stage, the **lexer**, walks one line and emits **tokens**: words (with quotes and escapes resolved) and operators (`|`, `>`, `>>`, `<`, `2>`, `&`).

```plaintext
  echo "hello world" | tr a-z A-Z > out.txt
        │
        ▼
  word(echo) · word(hello world) · pipe · word(tr) · word(a-z) · word(A-Z) · redir_out · word(out.txt)
```

Whitespace disappears. Operators are tokens of their own — they will never appear in a child's argv.

> [!scope] This chapter's job
> Only the scanner. No processes, no pipes, no files. When you finish, `Scan` turns a line
> into tokens and rejects unterminated quotes.

## Words and quotes
<!-- mode: read-and-implement tasks:1.1 -->

An unquoted word runs until whitespace or an operator. Single quotes keep every byte until the closing `'`. Double quotes do the same with `"`, and (in the next task) allow backslash escapes inside.

<!-- lang: go -->
### `TODO(1.1)` — quoted and unquoted pieces of `scanWord`

In `internal/lex/scan.go`, inside `scanWord`:

1. On a normal byte, `bump` and append it.
2. On `'`, skip the opener, append until `'`, error on EOF.
3. On `"`, skip the opener, append until `"` (leave backslash handling for 1.2).
4. When the loop ends, return `Token{Kind: Word, Lit: string(b), Pos: start}`.

`opStart` is already written: stop an unquoted word when the next bytes begin an operator.
<!-- /lang -->

## Escapes
<!-- mode: read-and-implement tasks:1.2 -->

A backslash outside quotes escapes the next byte: `\ ` is a space inside a word, `\>` is a literal `>`. Inside double quotes, `\"` is a quote. A trailing backslash with nothing after it is an error.

<!-- lang: go -->
### `TODO(1.2)` — backslash in `scanWord`

1. Outside quotes: on `\`, bump it; if EOF, error `trailing backslash`; else append the next bump.
2. Inside double quotes: the same rule for `\`.
<!-- /lang -->

## Operators
<!-- mode: read-and-implement tasks:1.3 -->

`|`, `<`, `&` are one character. `>` may be followed by another `>` for append. `2>` is stderr redirect when the characters are adjacent.

<!-- lang: go -->
### `TODO(1.3)` — `scanOp`

`atOp` already decided this is an operator. Map:

| Lexeme | Kind |
| --- | --- |
| `\|` | `Pipe` |
| `<` | `RedirIn` |
| `&` | `Amp` |
| `>` | `RedirOut` |
| `>>` | `RedirApp` |
| `2>` | `RedirErr` |

Set `Lit` to the lexeme spelling and `Pos` to the start index.
<!-- /lang -->

## Prove it
<!-- mode: read-only -->

<!-- lang: go -->
```bash
make test
make race
printf '%s\n' 'echo "a b" | cat > out' | make run
```
<!-- /lang -->

> [!check] Before you move on
> 1. Quotes never appear in the word's `Lit`.
> 2. `\>` is a word, not a redirect.
> 3. `>>` is one token. `2>` is one token.
> 4. An unclosed quote fails the scan.

### What is missing

Tokens do not start processes. Chapter 2 looks up a program on `PATH`, runs it, and adds the `cd` and `exit` builtins.
