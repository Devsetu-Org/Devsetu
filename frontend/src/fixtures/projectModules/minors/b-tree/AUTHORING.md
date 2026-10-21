# B-tree minor — authoring model

A chaptered minor: `constants/minors.ts` lists the chapters, and each `ready`
chapter has a fixture per language registered in `MINOR_CHAPTER_CONTENT`
(`fixtures/projectModules/index.ts`), keyed `minor/chapter/language`. The minor
stays `planned` (admin preview only) until enough chapters are authored to launch.
Chapters 1–5 are authored in Go; the benchmark chapter is still planned.

Languages start with Go only (`languages: ['go']` on the minor entry). Python
and C++ can follow the LSM tree minor’s porting pattern later. The learner
picks a language inside a chapter; it travels as `?lang=` and is remembered
per minor.

## Chapters

| # | id | Status | Student focus (task ids) | Author-owned (grows over time) |
| --- | --- | --- | --- | --- |
| 0 | `overview` | **ready** | reading only (`bTreeOverview.ts`): storage engines, B-tree vs LSM, where B-trees run, the plan | keep the chapter table in sync with `minors.ts` |
| 1 | `pager` | **ready** (Go) | 1.1 `WritePage`, 1.2 `ReadPage` (`pager/readwrite.go`); 1.3 `Allocate`, 1.4 `Free` (`pager/alloc.go`) | page size, header and free-page layout, `Open`/`Sync`/`Close`, REPL stub |
| 2 | `btree` | **ready** (Go) | 2.1 binary search, 2.2 `findLeaf`/`Get` (`btree/search.go`); 2.3 `leafPut`, 2.4 `split`, 2.5 `Insert` (`btree/insert.go`) | `PageIO`, node codec, `Check`, `DB.Get`/`Put` without WAL |
| 3 | `write-ahead-log` | **ready** (Go) | 3.1 `encode` (`wal/record.go`); 3.2 `Append` (`wal/writer.go`); 3.3 `scan` (`wal/reader.go`); 3.4 `recoverLog`/`commit` (`db/recover.go`) | `txn` overlay, `apply`, meta/commit records, checkpoint on `Close` |
| 4 | `buffer-pool` | **ready** (Go) | 4.1 `pin`/`Unpin` (`buffer/pin.go`); 4.2 `victim` (`buffer/evict.go`); 4.3 `flushFrame` (`buffer/flush.go`) | frame table, `Pool` as a `PageIO`, `FlushAll`, `db.go` wiring |
| 5 | `mutations` | **ready** (Go) | 5.1 `delete`, 5.2 `rebalance`, 5.3 `Delete` (`btree/delete.go`); 5.4 `Scan` (`db/scan.go`) | merge/redistribute helpers, `SeekLeaf`/`ReadLeaf`, public API complete |
| 6 | `benchmark` | planned | hosted runner (see LSM benchmark design) | placeholder until infra lands |

Build chapters are registered as they are authored (same pattern as
`lsmTreeChaptersGo.ts`). A chapter shows as "Soon" until it has a fixture.

## Product name

The engine is **`btreekv`**: a directory of pages (`data.db`), a WAL
(`wal.log`), and a small REPL. Public API matches the LSM minor on purpose:

```go
Open(dir, Options) (*DB, error)
Put(key, value []byte) error
Delete(key []byte) error
Get(key []byte) (value []byte, ok bool, err error)
Scan(start, end []byte, fn func(key, value []byte) bool) error
Close() error
```

So the later benchmark chapter can drive both engines with the same harness
protocol.

## Layout

```
<chapter>/
  theory.md            shared by every language
  go/files/            starter repo      go/solution/      edited files only
  python/files/        (later)
  cpp/files/           (later)
```

## Rules

- Same scratch-repo rule as Cinder and the LSM minor: chapter N ships only the
  files it needs, plus earlier chapters’ student code filled in (replaced by
  the learner’s own code at runtime via carry-forward).
- Task ids are `N.x`. Every block of a task uses the same `TODO(N.x)` marker,
  because the workspace counts a task done when its marker is gone from the file.
- Task ids, task count and test cases stay the same across languages when ports
  land. A port changes syntax and idiom, never what the chapter teaches.
- `theory.md` is shared. Anything that names a function, type, file or command
  goes inside `<!-- lang: go -->` … `<!-- /lang -->`. Do not hard-wrap theory.
- A chapter is done when its tests pass. Tests are given; they must fail with a
  clear message (or a `TODO` panic) on the starter and pass on `solution/`.
- No third-party dependencies: Go stdlib only for v1.
- `solution/` holds only the files students edit. It is never imported, so it
  never ships in the bundle. Chapter N+1’s starter contains chapter N solved as
  the reference a learner can opt into.
- Starters must compile. When a stub removes the last use of an import, drop
  the import and tell the student in the theory which one to add back.

## Carrying the learner's code forward

Same rules as the LSM minor (`utils/chapterCarry.ts`):

- Every task’s `file` belongs to that chapter for good. Later starters ship it
  byte-identical to that chapter’s `solution/`. Never edit a learner file to
  add a later feature; put seams in given files instead.
- Put student functions in stable files (`pager/alloc.go`, `btree/insert.go`,
  `db/recover.go`, `buffer/evict.go`, …) and keep evolving wiring in given
  files (`pager.go`, `db.go`, `pool.go`).
- Later features go in through given hooks (for example the buffer pool wraps
  the pager; the WAL sits under `commit` the same way the LSM minor did).

## Suggested Go package layout (chapter 5)

```
cmd/btreekv/main.go
internal/pager/       // ch1
internal/btree/       // ch2
internal/wal/         // ch3
internal/buffer/      // ch4
internal/db/          // open, commit, scan; grows each chapter
```

## Verifying a chapter

With the chapter’s `solution/` overlaid on `files/`:

```bash
gofmt -l .
go vet ./...
go test -race -count=1 ./...
```

The starter must compile (`go vet` clean) and fail only on its own `TODO`
panics. Learner-owned files must be byte-identical in every later chapter’s
`files/` once those chapters exist.

## Design notes (chapters 1–5)

- **One write = one batch.** The tree runs over a `db.txn` overlay, so every
  `WritePage` lands in memory. `txn.records()` turns the result into page
  after-images, a meta record (root, page count, freelist head) and a commit
  record; `commit` logs them, then `apply` writes pages. Frees are deferred and
  logged as free-page images, so a page is never freed on disk before the log.
- **Recovery** applies only committed batches and cuts the log at the last
  commit (not at the last good record), so an unfinished batch can never ride
  along with a later commit.
- **Buffer pool** sits under `apply` as `db.store`. Frames remember the log size
  when they were dirtied; `flushFrame` syncs the log up to it first.
  `WritePage` pins without reading, so recovery can write pages a torn file
  never had.
- Learner files are pure-function-ish and stable; wiring (`db.go`, `pool.go`,
  `txn.go`, `apply.go`) is given and changes between chapters.

## Authoring tips

Starters and solutions were generated from one annotated source per learner
file (`//#TODO N.x name` … `//#BODY` … `//#END`, `//#SOL` for solution-only
imports). If you edit a solution by hand, keep the starter's `TODO(N.x)`
markers and hints in step and re-check that later chapters' `files/` still carry
the solution byte for byte.

## Not built yet

Limits worth knowing: the log is only emptied on `Close`, so a long-running,
frequently crashing process replays its whole history on every open; pages are
logged whole (no deltas); a single writer lock serializes all writes; keys are
at most 128 bytes and values 1024. Python and C++ ports are not started.
