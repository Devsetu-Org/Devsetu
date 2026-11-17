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
<!-- lang: python -->
### `TODO(2.1)` — `look_path` in `tinysh/exec/path.py`

1. Empty name → `ErrNotFound`.
2. Name with a separator → join with `directory` when relative, then `check_exec`.
3. Otherwise read `PATH` via `env_get`, split on `os.pathsep`, join each dir with the name, `check_exec` until one works.
<!-- /lang -->
<!-- lang: cpp -->
### `TODO(2.1)` — `LookPath` in `src/exec/path.cc`

1. Empty name → `NotFound`.
2. Name with `/` → join with `dir` when relative, then `CheckExec`.
3. Otherwise read `PATH` via `EnvGet`, split on `:`, join each dir with the name, `CheckExec` until one works.
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
<!-- lang: python -->
### `TODO(2.2)` — `start_process` and `wait_process` in `tinysh/exec/run.py`

1. `look_path(argv[0], s.dir, s.env)`.
2. Build `subprocess.Popen` with `cwd`, `env`, and stdio from `io` (use the given `_has_fileno` / PIPE helpers when a stream lacks `fileno`).
3. Return the process.
4. `wait_process`: `wait`, join pumps, then `exit_status`.
<!-- /lang -->
<!-- lang: cpp -->
### `TODO(2.2)` — `StartProcess` and `WaitProcess` in `src/exec/run.cc`

1. `LookPath(argv[0], s.dir, s.env)`.
2. `fork`; in the child `dup2` the stdio fds, `chdir`, `execve`.
3. Return the pid.
4. `WaitProcess`: `waitpid` and map to an exit status.
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
<!-- lang: python -->
### `TODO(2.3)` — `builtin_cd` and `builtin_exit` in `tinysh/exec/builtin.py`

`cd`: HOME with no args; resolve relative paths with `os.path.join(s.dir, ...)`; require a directory; set `s.dir`.

`exit`: optional int (default 0); `s.set_exit(code)` and return it.
<!-- /lang -->
<!-- lang: cpp -->
### `TODO(2.3)` — `BuiltinCd` and `BuiltinExit` in `src/exec/builtin.cc`

`cd`: HOME with no args; resolve relative paths; `stat` must be a directory; set `s.dir`.

`exit`: optional int (default 0); `SetExit(code)` and return it.
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
<!-- lang: python -->
```bash
make test
printf '%s\n' 'echo hello' 'cd /' 'pwd' | make run
```
<!-- /lang -->
<!-- lang: cpp -->
```bash
make test
make asan
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
