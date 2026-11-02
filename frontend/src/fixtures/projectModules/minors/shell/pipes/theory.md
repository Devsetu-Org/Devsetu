## Where you are
<!-- mode: read-only -->

Redirects attach files. A **pipeline** attaches processes to each other: stdout of the left command feeds stdin of the right. The pipeline's exit status is the status of the **last** command.

```plaintext
  printf 'abc\n' | tr a-z A-Z
           │
           ▼
  [printf] ----pipe----> [tr] ----> shell stdout
  status = status(tr)
```

> [!scope] This chapter's job
> Split on `|` in the parser, wire `os.Pipe` between children, and wait for the last status.

## Split the pipeline
<!-- mode: read-and-implement tasks:4.1 -->

A single command already parses. When you see `|`, read another command. A trailing `|` with nothing after it is an error.

<!-- lang: go -->
### `TODO(4.1)` — finish `splitPipeline` in `internal/parse/pipeline.go`

The first command is already parsed. While `kind() == Pipe`: `bump`, reject EOF/`&`/`|` as the next token, parse another `cmd`, append it.
<!-- /lang -->

## Wire the pipes
<!-- mode: read-and-implement tasks:4.2 -->

For each adjacent pair, `os.Pipe` gives a read end and a write end. The left command's stdout is the write end; the right command's stdin is the read end. The parent must close the ends it does not need, or the pipeline hangs.

<!-- lang: go -->
### `TODO(4.2)` — multi-stage branch of `wirePipes` in `internal/exec/pipe.go`

The `n == 1` path is given. For `n > 1`:

1. For each stage `i`, set base stdio from the shell (with `shareWriter` on stdout/stderr).
2. If `i > 0`, stdin is the previous pipe's read end.
3. If `i < n-1`, create a pipe and set stdout to the write end.
4. `startCmd`, then close the write end you handed over and the previous read end.
<!-- /lang -->

## Wait for status
<!-- mode: read-and-implement tasks:4.3 -->

Wait for every process. The status that matters is the last one's.

<!-- lang: go -->
### `TODO(4.3)` — `waitForeground` in `internal/exec/wait.go`

Loop over `procs`, `waitCmd` each, keep the last status, return it.
<!-- /lang -->

## Prove it
<!-- mode: read-only -->

<!-- lang: go -->
```bash
make test
make race
printf '%s\n' "printf 'abc\\n' | tr a-z A-Z" | make run
```
<!-- /lang -->

> [!check] Before you move on
> 1. Data flows left to right.
> 2. `true | false` is non-zero. `false | true` is zero.
> 3. Closing unused pipe ends — no hang on short output.

### What is missing

A trailing `&` still does not background work. Chapter 5 records background jobs and reaps them with `wait`.
