# Shell minor — authoring model

Chaptered minor. Overview ready; build chapters in Go. Minor stays `planned`.
Benchmark planned.

## Chapters

| # | id | Status | Student focus | Author-owned |
| --- | --- | --- | --- | --- |
| 0 | `overview` | **ready** | reading (`shellOverview.ts`) | sync with `minors.ts` |
| 1 | `lexer` | **ready** (Go) | 1.1–1.3 (`lex/scan.go`) | token kinds, `Scan` loop |
| 2 | `exec` | **ready** (Go) | 2.1–2.3 path/run/builtin | session, spawn helpers |
| 3 | `redirects` | **ready** (Go) | 3.1–3.3 parse/open/apply | Command stdio wiring |
| 4 | `pipes` | **ready** (Go) | 4.1–4.3 split/wire/wait | pipeline runner |
| 5 | `jobs` | **ready** (Go) | 5.1–5.3 jobs/wait/interrupt | job table |
| 6 | `benchmark` | planned | placeholder | — |

## Product

**`tinysh`**. Module `github.com/devlabs/tinysh`. Read lines from stdin, run one
statement per line (no multi-line). Gold tests compare stdout/stderr/exit to
fixtures. Use `os/exec` and `os.Pipe`. No full job-control TTY. No globs, no
`$(…)`, no functions. Operators: `|`, `>`, `>>`, `<`, `2>`, `&`.

## Layout / rules

Same as other minors. Carry-forward on owned task files.

## Package layout (ch5)

```
cmd/tinysh/main.go
internal/lex/
internal/ast/      // Cmd, Redirect, Pipeline
internal/parse/
internal/exec/     // run, builtins, redirects, pipes, jobs
```
