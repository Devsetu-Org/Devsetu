## Where you are
<!-- mode: read-only -->

Simple commands run. This chapter teaches **redirection**: the shell opens a file and attaches it to fd 0, 1, or 2 *before* the child starts. The operator never appears in argv.

```plaintext
  echo hello > out.txt
      │
      ▼
  argv = ["echo","hello"]
  open out.txt (create, trunc) → child's stdout
```

> [!scope] This chapter's job
> Parse redirect tokens into the AST, open the files, and apply them onto the command's stdio.

## Parse redirects
<!-- mode: read-and-implement tasks:3.1 -->

When the parser sees `>`, `>>`, `<`, or `2>`, the next token must be a word — the path.

<!-- lang: go -->
### `TODO(3.1)` — `parseRedir` in `internal/parse/redir.go`

1. Remember `Kind` from the current token and `bump`.
2. Require `Word`; otherwise error `expected filename after redirect`.
3. Return `ast.Redir{Kind, File: lit}`.
<!-- /lang -->
<!-- lang: python -->
### `TODO(3.1)` — `parse_redir` in `tinysh/parse/redir.py`

1. Remember `kind` from the current token and `bump`.
2. Require `Word`; otherwise error `expected filename after redirect`.
3. Return `Redir(kind=k, file=lit)`.
<!-- /lang -->
<!-- lang: cpp -->
### `TODO(3.1)` — `ParseRedir` in `src/parse/redir.cc`

1. Remember `Kind` from the current token and `Bump`.
2. Require `kWord`; otherwise error `expected filename after redirect`.
3. Return `Redir{k, lit}`.
<!-- /lang -->

## Open files
<!-- mode: read-and-implement tasks:3.2 -->

Paths are relative to the shell's working directory. `>` truncates, `>>` appends, `<` reads, `2>` truncates like `>` but will be wired to stderr.

<!-- lang: go -->
### `TODO(3.2)` — `openOne` in `internal/exec/open.go`

1. Join `r.File` with `dir` when relative.
2. Open with the right flags for `RedirOut` / `RedirApp` / `RedirIn` / `RedirErr`.
<!-- /lang -->
<!-- lang: python -->
### `TODO(3.2)` — `open_one` in `tinysh/exec/open.py`

1. Join `r.file` with `directory` when relative.
2. Open with trunc / append / read for `RedirOut` / `RedirApp` / `RedirIn` / `RedirErr`.
<!-- /lang -->
<!-- lang: cpp -->
### `TODO(3.2)` — `OpenOne` in `src/exec/open.cc`

1. Join `r.file` with `dir` when relative.
2. `open` with trunc / append / read flags for `kRedirOut` / `kRedirApp` / `kRedirIn` / `kRedirErr`.
<!-- /lang -->

## Wire file descriptors
<!-- mode: read-and-implement tasks:3.3 -->

`applyRedirsIO` copies the base stdio, then for each redirect replaces `in`, `out`, or `err` with the opened file. Later redirects of the same kind win.

<!-- lang: go -->
### `TODO(3.3)` — `applyRedirsIO` in `internal/exec/apply.go`

| Kind | Field |
| --- | --- |
| `RedirIn` | `in` |
| `RedirOut`, `RedirApp` | `out` |
| `RedirErr` | `err` |
<!-- /lang -->
<!-- lang: python -->
### `TODO(3.3)` — `apply_redirs_io` in `tinysh/exec/apply.py`

| Kind | Field |
| --- | --- |
| `RedirIn` | `stdin` |
| `RedirOut`, `RedirApp` | `stdout` |
| `RedirErr` | `stderr` |
<!-- /lang -->
<!-- lang: cpp -->
### `TODO(3.3)` — `ApplyRedirsIO` in `src/exec/apply.cc`

| Kind | Field |
| --- | --- |
| `kRedirIn` | `in` |
| `kRedirOut`, `kRedirApp` | `out` |
| `kRedirErr` | `err` |
<!-- /lang -->

## Prove it
<!-- mode: read-only -->

<!-- lang: go -->
```bash
make test
make race
printf '%s\n' 'echo hello > out.txt' 'cat out.txt' | make run
```
<!-- /lang -->
<!-- lang: python -->
```bash
make test
printf '%s\n' 'echo hello > out.txt' 'cat out.txt' | make run
```
<!-- /lang -->
<!-- lang: cpp -->
```bash
make test
make asan
printf '%s\n' 'echo hello > out.txt' 'cat out.txt' | make run
```
<!-- /lang -->

> [!check] Before you move on
> 1. `echo hi > f` writes `hi` to `f` and prints nothing on the shell's stdout.
> 2. `>>` appends. `<` feeds stdin.
> 3. `2>` captures stderr.
> 4. argv has no `>` and no filename from the redirect.

### What is missing

Two processes still cannot talk. Chapter 4 connects stdout of one to stdin of the next with a pipe.
