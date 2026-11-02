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

## Open files
<!-- mode: read-and-implement tasks:3.2 -->

Paths are relative to the shell's working directory. `>` truncates, `>>` appends, `<` reads, `2>` truncates like `>` but will be wired to stderr.

<!-- lang: go -->
### `TODO(3.2)` — `openOne` in `internal/exec/open.go`

1. Join `r.File` with `dir` when relative.
2. Open with the right flags for `RedirOut` / `RedirApp` / `RedirIn` / `RedirErr`.
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

## Prove it
<!-- mode: read-only -->

<!-- lang: go -->
```bash
make test
make race
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
