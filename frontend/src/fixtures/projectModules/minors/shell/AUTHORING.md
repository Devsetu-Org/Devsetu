# Shell minor — authoring model

Chaptered minor. Overview ready; chapters in Go, Python, and C++. Minor stays `planned`.
Benchmark planned.

## Chapters

| # | id | Status | Student focus | Author-owned |
| --- | --- | --- | --- | --- |
| 0 | `overview` | **ready** | reading (`shellOverview.ts`) | sync with `minors.ts` |
| 1 | `lexer` | **ready** (go, python, cpp) | 1.1–1.3 scan words/quotes/ops | token kinds, `Scan` loop |
| 2 | `exec` | **ready** (go, python, cpp) | 2.1–2.3 path/run/builtin | session, spawn helpers |
| 3 | `redirects` | **ready** (go, python, cpp) | 3.1–3.3 parse/open/apply | Command stdio wiring |
| 4 | `pipes` | **ready** (go, python, cpp) | 4.1–4.3 split/wire/wait | pipeline runner |
| 5 | `jobs` | **ready** (go, python, cpp) | 5.1–5.3 jobs/wait/interrupt | job table |
| 6 | `benchmark` | planned | placeholder | — |

## Product

**`tinysh`**. Line-oriented: read lines from stdin, run one statement per line (no multi-line). Gold tests compare stdout/stderr/exit to fixtures. Operators: `|`, `>`, `>>`, `<`, `2>`, `&`. No full job-control TTY. No globs, no `$(…)`, no functions.

| Language | Module / layout | Process API | Verify |
| --- | --- | --- | --- |
| Go | `github.com/devlabs/tinysh` (`internal/lex`, `parse`, `exec`) | `os/exec` + `os.Pipe` | `make test` / `race` / `run` |
| Python | `tinysh` (`tinysh/lex`, `parse`, `exec`) | `subprocess` + `os.pipe` | `make test` / `run` |
| C++ | `src/lex`, `src/parse`, `src/exec` | posix `fork`/`execve`/`pipe` | `make test` / `asan` / `run` |

## Layout / rules

```
<chapter>/
  theory.md            shared; `<!-- lang: go|python|cpp -->` blocks
  go/files/            starter      go/solution/
  python/files/        starter      python/solution/
  cpp/files/           starter      cpp/solution/
```

Same as other minors: carry-forward on owned task files (byte-identical in later starters), `TODO(N.x)` markers, starters compile and fail until filled, `solution/` never globbed. Chapters registered in `shellChaptersGo.ts`, `shellChaptersPython.ts`, and `shellChaptersCpp.ts`.

## Package layout (ch5)

**Go**

```
cmd/tinysh/main.go
internal/lex/
internal/ast/
internal/parse/
internal/exec/
```

**Python**

```
tinysh/__main__.py
tinysh/lex/
tinysh/ast/
tinysh/parse/
tinysh/exec/
tests/
```

**C++**

```
cmd/tinysh/main.cc
src/lex/
src/ast/
src/parse/
src/exec/
tests/
```
