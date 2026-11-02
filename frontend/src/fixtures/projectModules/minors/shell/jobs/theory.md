## Where you are
<!-- mode: read-only -->

Pipelines run in the foreground and the shell waits. A trailing `&` means **do not wait** — record the work as a job and return. The `wait` builtin reaps every recorded job. A light interrupt hook forwards Ctrl-C to foreground children.

```plaintext
  sleep 1 &
  wait
      │
      ▼
  start sleep, store job, return 0
  wait → reap job, return its status
```

> [!scope] This chapter's job
> Parse `&`, background execution, `wait`, and a foreground SIGINT forwarder. No process groups, no TTY job control.

## Background `&`
<!-- mode: read-and-implement tasks:5.1 -->

After the pipeline commands, an `&` marks background. Parsing of `&` is given (`takeBackground`). Your job is `addJob`: wait in a goroutine and store the result on a channel.

<!-- lang: go -->
### `TODO(5.1)` — `addJob` in `internal/exec/jobs.go`

1. Make a `job` with `done: make(chan int, 1)`.
2. Append it to `s.jobs` under `s.mu`.
3. In a goroutine, `waitCmd` every proc; send the last status on `done` and close it.
<!-- /lang -->

## wait
<!-- mode: read-and-implement tasks:5.2 -->

`wait` with no arguments reaps every background job started since the last wait.

<!-- lang: go -->
### `TODO(5.2)` — `builtinWait` in `internal/exec/jobs.go`

1. Reject arguments.
2. Under `s.mu`, take the job list and clear `s.jobs`.
3. Receive from each `done` channel; return the last status.
<!-- /lang -->

## Foreground interrupt
<!-- mode: read-and-implement tasks:5.3 -->

While a foreground pipeline runs, a SIGINT should reach the children. Without full job control, signal each child process directly.

<!-- lang: go -->
### `TODO(5.3)` — `withForegroundInterrupt` in `internal/exec/signal.go`

1. `signal.Notify` on `SIGINT`.
2. Run `fn` in a goroutine.
3. On signal, `Process.Signal(SIGINT)` each proc.
4. When `fn` returns, stop notifying and return its status.
<!-- /lang -->

## Prove it
<!-- mode: read-only -->

<!-- lang: go -->
```bash
make test
make race
printf '%s\n' "sh -c 'echo done > bg.txt' &" 'wait' 'cat bg.txt' | make run
```
<!-- /lang -->

> [!check] Before you move on
> 1. `&` returns immediately; the file appears after `wait`.
> 2. `wait` with args is rejected.
> 3. The interrupt hook compiles and forwards SIGINT in the foreground path.

### What is missing

Full job control (process groups, `fg`/`bg`, a controlling TTY) is a later minor. So are globs, `$(…)`, and shell functions. You now have a line-oriented shell that gets argv and file descriptors right.
