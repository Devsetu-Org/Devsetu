## Where you are
<!-- mode: read-only -->

The lexer is done. This chapter runs a **simple command**: one argv, no redirects, no pipes. You look up the program, start it, wait for it, and return its exit status. Two builtins stay inside the shell: `cd` and `exit`.

```plaintext
  echo hello
      │
      ▼
  LookPath("echo") → /bin/echo
  Start with argv ["echo","hello"], wait, status 0
```

> [!scope] This chapter's job
> PATH lookup, start+wait, and the `cd` / `exit` builtins. Redirects and pipes come next.

## PATH lookup
<!-- mode: read-and-implement tasks:2.1 -->

If the name contains a `/`, it is a path: resolve it against the shell's working directory when it is relative, then check that it exists and is executable. Otherwise split `PATH` from the environment and try each directory.

<!-- lang: go -->
### `TODO(2.1)` — `LookPath` in `internal/exec/path.go`

1. Empty name → `ErrNotFound`.
2. Name with a separator → join with `dir` when relative, then `checkExec`.
3. Otherwise read `PATH` via `envGet`, `filepath.SplitList`, join each dir with the name, `checkExec` until one works.
<!-- /lang -->

## Start and wait
<!-- mode: read-and-implement tasks:2.2 -->

`startProcess` builds an `os/exec.Cmd`, sets `Dir`, `Env`, and the three stdio streams, then `Start`s. `waitProcess` waits and maps the error to an exit status.

<!-- lang: go -->
### `TODO(2.2)` — `startProcess` and `waitProcess` in `internal/exec/run.go`

1. `LookPath(argv[0], s.Dir, s.Env)`.
2. `Command(path, argv[1:]...)` with `Dir`, `Env`, `Stdin`/`Stdout`/`Stderr` from `io`.
3. `Start`; return the cmd.
4. `waitProcess`: `Wait`, then `exitStatus` (already written).
<!-- /lang -->

## Builtins
<!-- mode: read-and-implement tasks:2.3 -->

`cd` changes `s.Dir`. With no args it uses `HOME`. `exit` records a status on the shell so the REPL can stop.

<!-- lang: go -->
### `TODO(2.3)` — `builtinCd` and `builtinExit` in `internal/exec/builtin.go`

`cd`:

1. No args → `HOME` from `envGet`; one arg → that path; more → error.
2. Resolve relative paths with `filepath.Join(s.Dir, ...)`.
3. `Stat` must be a directory; then set `s.Dir`.

`exit`:

1. Optional integer argument (default 0).
2. `s.setExit(code)` and return that code.
<!-- /lang -->

## Prove it
<!-- mode: read-only -->

<!-- lang: go -->
```bash
make test
make race
printf '%s\n' 'echo hello' 'cd /' 'pwd' | make run
```
<!-- /lang -->

> [!check] Before you move on
> 1. `echo` prints and exits 0. `false` exits non-zero.
> 2. `cd` changes the directory for the next command.
> 3. `exit 7` stops the shell with status 7.
> 4. An unknown command fails with a clear error.

### What is missing

Operators still do nothing useful beyond lexing. Chapter 3 opens files and wires them to stdin, stdout, or stderr before the child starts.
