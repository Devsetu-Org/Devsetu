# LSM tree minor — authoring model

A chaptered minor: `constants/minors.ts` lists the chapters, and each `ready`
chapter has a fixture per language registered in `MINOR_CHAPTER_CONTENT`
(`fixtures/projectModules/index.ts`), keyed `minor/chapter/language`. The minor
stays `planned` (admin preview only) until enough chapters are authored to launch.

Languages are Go, Python and C++ (`languages` on the minor entry). The learner
picks one on the minor page; it travels as `?lang=` and is remembered per minor.

## Chapters

| # | id | Status | Student focus | Author-owned (grows over time) |
| --- | --- | --- | --- | --- |
| 0 | `overview` | **ready** | reading only (`lsmTreeOverview.ts`, same shape as track blogs): what, where it is used, the plan | keep the chapter table in sync with `minors.ts` |
| 1 | `memtable` | **ready** (go, python, cpp) | skiplist search + put, tombstones, iterator | build files, REPL entry point |
| 2 | `write-ahead-log` | **ready** (go) | record framing, append + fsync, replay to the torn tail, `db/recover.go` (`recoverLog`, `commit`) | `wal.Create`/`OpenAppend`, `db.go`, REPL on a data dir |
| 3 | `sstable` | **ready** (go) | `sstable/build.go` (blocks, index, footer), `sstable/lookup.go` (open, one-block get), `db/flush.go` | format encoding, `writer.go`/`reader.go` wrappers, table iterator, `addTable`, newest-first `DB.Get` |
| 4 | `read-path` | **ready** (go) | Bloom build + query, merging iterator, `db/scan.go` | filter hooks in `writer.go`/`reader.go` |
| 5 | `compaction` | **ready** (go) | merge with tombstone dropping, atomic manifest save, `db/compact.go` | manifest load, manifest-aware `addTable`, orphan cleanup, auto trigger, `stats` |

Chapters 2–5 are registered in `lsmTreeChaptersGo.ts`, which globs each
`<chapter>/go/files/**` (never `solution/`). A chapter shows as "Soon" in any
language it has no fixture for, and the in-chapter language dropdown only lists
languages that exist for that chapter.

## Layout

```
<chapter>/
  theory.md            shared by every language
  go/files/            starter repo      go/solution/      edited files only
  python/files/        starter repo      python/solution/
  cpp/files/           starter repo      cpp/solution/
```

## Rules

- Same scratch-repo rule as Cinder: chapter N ships only the files it needs,
  plus earlier chapters' student code filled in (replaced by the learner's own
  code at runtime; see below).
- Task ids are `N.x`. Every block of a task uses the same `TODO(N.x)` marker,
  because the workspace counts a task done when its marker is gone from the file.
- Task ids, task count and test cases are the same in every language. A port
  changes syntax and idiom, never what the chapter teaches or checks.
- `theory.md` is shared. Anything that names a function, type, file or command
  goes inside `<!-- lang: go -->` … `<!-- /lang -->` (a block may list several,
  e.g. `<!-- lang: python, cpp -->`). Text outside lang blocks shows for all.
- Do not hard-wrap `theory.md`. The theory renderer turns every source line into its
  own paragraph, so write one line per paragraph or list item.
- A chapter is done when its tests pass. Tests are given; they must fail with a
  clear message (or a `TODO` panic / exception) on the starter and pass on `solution/`.
- No third-party dependencies: Go stdlib, Python stdlib `unittest` (3.9+),
  C++17 with a plain Makefile and `tests/check.h`.
- `solution/` holds only the files students edit. It is never imported, so it
  never ships in the bundle. Chapter N+1's starter does contain chapter N
  solved: that is the reference a learner can opt into.
- Starters must compile. When a stub removes the last use of an import, drop
  the import and tell the student in the theory which one to add back.

## Carrying the learner's code forward

A chapter opens on the learner's own code from earlier chapters, not ours. The
workspace (`utils/chapterCarry.ts`) does this on the first visit to a chapter:

- Every task's `file` belongs to that chapter. For each earlier chapter whose
  tasks are all done, its files come from the latest earlier chapter that saved
  them, so a fix made later carries on too. A chapter is carried whole or not
  at all.
- If any earlier chapter is unfinished or never opened, the editor shows a
  gate: go finish it, or start with the reference for it.
- "Earlier code" in the tab bar pulls in the learner's latest finished code
  again, or swaps every earlier file for the reference. Reset starts the
  chapter over from the learner's finished earlier chapters.

That only works if the files are stable, so:

- A task file is learner-owned for good. Every later starter ships it
  byte-identical to that chapter's `solution/`. Never edit it to add a
  feature; check with a diff of each chapter's `solution/` files against every
  later `files/`.
- Put student functions in their own files (`db/recover.go`, `db/flush.go`,
  `sstable/build.go`, `sstable/lookup.go`, …) and keep the evolving code in
  given files (`db/db.go`, `sstable/writer.go`, `sstable/reader.go`).
- Later features go in through given seams. Public wrappers call the student
  function and a hook that does nothing until a later chapter fills it in:
  `Writer.Add` / `Finish` call `add` / `finish` plus `noteKey` / `writeFilter`;
  `Open` / `Get` call `open` / `get` plus `loadFilter` / `mayContain`;
  `flush` hands its table to the given `addTable`, which learns the manifest
  in chapter 5.
- A test in a later chapter may call learner functions, but only through
  signatures that never change.

## Verifying a chapter

```bash
SRC=frontend/src/fixtures/projectModules/minors/lsm-tree/<chapter>
T=$(mktemp -d)
for L in go python cpp; do
  cp -R $SRC/$L/files $T/$L && cp -R $SRC/$L/solution/. $T/$L/
done
(cd $T/go && gofmt -l . && go vet ./... && make test && make race)
(cd $T/python && make test)
(cd $T/cpp && make test)
# AddressSanitizer hangs on recent macOS clang; run it in Linux instead:
docker run --rm -v "$T/cpp":/src -w /src gcc:13 make asan
```

Also run the starters (`files/` alone) and confirm every task's tests fail.
