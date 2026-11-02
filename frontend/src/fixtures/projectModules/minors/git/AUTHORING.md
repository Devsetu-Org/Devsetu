# Git minor — authoring model

Chaptered minor. Overview is ready; build chapters are authored in Go. The minor
stays `planned` until launch. Benchmark stays planned.

## Chapters

| # | id | Status | Student focus (task ids) | Author-owned |
| --- | --- | --- | --- | --- |
| 0 | `overview` | **ready** | reading (`gitOverview.ts`) | keep in sync with `minors.ts` |
| 1 | `objects` | **ready** (Go) | 1.1 hash, 1.2 store put/get, 1.3 blob, 1.4 tree, 1.5 commit | `cmd/tinygit`, object header format |
| 2 | `refs` | **ready** (Go) | 2.1 read/write ref, 2.2 symbolic HEAD, 2.3 update-ref | repo layout `.tinygit/` |
| 3 | `index` | **ready** (Go) | 3.1 index codec, 3.2 add, 3.3 status | worktree path helpers |
| 4 | `commit-checkout` | **ready** (Go) | 4.1 write-tree, 4.2 commit, 4.3 checkout | safety checks given as stubs |
| 5 | `history-merge` | **ready** (Go) | 5.1 log walk, 5.2 tree diff, 5.3 merge-base, 5.4 three-way merge | conflict marker format |
| 6 | `benchmark` | planned | placeholder | — |

## Product

**`tinygit`**. Module `github.com/devlabs/tinygit`. Repo dir contains `.tinygit/`
(objects, refs, HEAD, index). SHA-1. Loose objects only: `zlib(type size\\0content)`
stored at `objects/aa/bbcc…`. Custom index (not Git-compatible): versioned table of
`(path, mode, hash)`. File-level three-way merge; conflict markers
`<<<<<<<`, `=======`, `>>>>>>>`. No remotes, packfiles, rebase, renames.

CLI (subcommand style): `init`, `hash-object`, `cat-file`, `update-ref`, `add`,
`status`, `write-tree`, `commit`, `checkout`, `log`, `diff`, `merge`.

## Layout

```
<chapter>/theory.md
<chapter>/go/files/      starter
<chapter>/go/solution/   edited files only
```

## Rules

Same as query-engine / B-tree: `TODO(N.x)`, carry-forward on task `file`s,
starters compile, `solution/` never globbed, Go stdlib only, `gofmt` / `go vet` /
`go test -race`.

## Package layout (ch5)

```
cmd/tinygit/main.go
internal/object/   // hash, store, blob, tree, commit
internal/ref/
internal/index/
internal/worktree/ // write-tree, commit, checkout
internal/diff/
internal/merge/
```
