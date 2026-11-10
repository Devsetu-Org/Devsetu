# Git minor — authoring model

Chaptered minor. Overview is ready; build chapters are authored in Go, Python,
and C++. The minor stays `planned` until launch. Benchmark stays planned.

## Chapters

| # | id | Status | Student focus (task ids) | Author-owned |
| --- | --- | --- | --- | --- |
| 0 | `overview` | **ready** | reading (`gitOverview.ts`) | keep in sync with `minors.ts` |
| 1 | `objects` | **ready** (go, python, cpp) | 1.1 hash, 1.2 store put/get, 1.3 blob, 1.4 tree, 1.5 commit | CLI entry, object header format |
| 2 | `refs` | **ready** (go, python, cpp) | 2.1 read/write ref, 2.2 symbolic HEAD, 2.3 update-ref | repo layout `.tinygit/` |
| 3 | `index` | **ready** (go, python, cpp) | 3.1 index codec, 3.2 add, 3.3 status | worktree path helpers |
| 4 | `commit-checkout` | **ready** (go, python, cpp) | 4.1 write-tree, 4.2 commit, 4.3 checkout | safety checks given as stubs |
| 5 | `history-merge` | **ready** (go, python, cpp) | 5.1 log walk, 5.2 tree diff, 5.3 merge-base, 5.4 three-way merge | conflict marker format |
| 6 | `benchmark` | planned | placeholder | — |

## Product

**`tinygit`**. Repo dir contains `.tinygit/` (objects, refs, HEAD, index). SHA-1.
Loose objects only: `zlib(type size\0content)` stored at `objects/aa/bbcc…`.
Custom index (not Git-compatible): versioned table of `(path, mode, hash)`.
File-level three-way merge; conflict markers `<<<<<<<`, `=======`, `>>>>>>>`.
No remotes, packfiles, rebase, renames.

CLI (subcommand style): `init`, `hash-object`, `cat-file`, `update-ref`, `add`,
`status`, `write-tree`, `commit`, `checkout`, `log`, `diff`, `merge`.

## Layout

```
<chapter>/theory.md
<chapter>/go/files/       starter      go/solution/       edited files only
<chapter>/python/files/   starter      python/solution/
<chapter>/cpp/files/      starter      cpp/solution/
```

Module / package paths:

| Language | Path |
| --- | --- |
| Go | `github.com/devlabs/tinygit` (`internal/object`, `internal/ref`, `internal/index`, `internal/worktree`, `internal/diff`, `internal/merge`) |
| Python | `tinygit` (`tinygit/object`, `tinygit/ref`, `tinygit/index`, `tinygit/worktree`, `tinygit/diff`, `tinygit/merge`) |
| C++ | `src/object`, `src/ref`, `src/index`, `src/worktree`, `src/diff`, `src/merge` (`-lz`) |

Chapters 1–5 are registered in `gitChaptersGo.ts`, `gitChaptersPython.ts`, and
`gitChaptersCpp.ts`, which glob each `<chapter>/<lang>/files/**` (never `solution/`).

## Rules

Same as query-engine / B-tree / LSM: `TODO(N.x)`, carry-forward on task `file`s,
starters compile, `solution/` never globbed, no third-party deps beyond system
zlib for C++ (`-lz`). Task ids, task count and test cases are the same in every
language.

- Go: stdlib only, `gofmt` / `go vet` / `go test -race`
- Python: stdlib `unittest` (3.9+)
- C++: C++17, plain Makefile, `tests/check.h`, AddressSanitizer target

## Package layout (ch5)

```
# Go
cmd/tinygit/main.go
internal/object/   // hash, store, blob, tree, commit
internal/ref/
internal/index/
internal/worktree/ // write-tree, commit, checkout
internal/diff/
internal/merge/

# Python
tinygit/__main__.py
tinygit/object/
tinygit/ref/
tinygit/index/
tinygit/worktree/
tinygit/diff/
tinygit/merge/

# C++
cmd/tinygit/main.cc
src/object/
src/ref/
src/index/
src/worktree/
src/diff/
src/merge/
```

## Verifying a chapter

```bash
SRC=frontend/src/fixtures/projectModules/minors/git/<chapter>
T=$(mktemp -d)
for L in go python cpp; do
  cp -R $SRC/$L/files $T/$L && cp -R $SRC/$L/solution/. $T/$L/
  (cd $T/$L && make test)
done
```
