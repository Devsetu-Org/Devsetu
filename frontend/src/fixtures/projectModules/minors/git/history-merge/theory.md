## Where you are
<!-- mode: read-only -->

History is a DAG of commits. `log` walks first parents. `diff` compares two trees path by path. `merge` finds a common base and combines both tips; when both sides changed the same path, write conflict markers.

```plaintext
  <<<<<<< ours
  ...ours bytes...
  =======
  ...theirs bytes...
  >>>>>>> theirs
```

> [!scope] This chapter's job
> `LogWalk`, `TreeDiff`, `MergeBase`, and a file-level three-way `Merge` with
> fast-forward, clean merge, and conflict fixtures.

## log
<!-- mode: read-and-implement tasks:5.1 -->

<!-- lang: go -->
### `TODO(5.1)` — `LogWalk`

From tip, follow `Parents[0]` until none. Newest first. Guard against cycles.
<!-- /lang -->

## tree diff
<!-- mode: read-and-implement tasks:5.2 -->

Flatten both trees. Status `A` / `M` / `D`. Sort by path. `flatten` is given.

<!-- lang: go -->
### `TODO(5.2)` — `TreeDiff`
<!-- /lang -->

## merge-base
<!-- mode: read-and-implement tasks:5.3 -->

Mark every ancestor of `a`. Walk `b`; the first commit already marked is a merge base.

<!-- lang: go -->
### `TODO(5.3)` — `MergeBase`
<!-- /lang -->

## three-way merge
<!-- mode: read-and-implement tasks:5.4 -->

If base equals theirs, already up to date. If base equals ours, fast-forward. Otherwise, for each path take ours, theirs, or both; on conflict call `writeConflict` (given) with the marker constants.

A clean merge creates a commit with **two parents** and updates HEAD.

<!-- lang: go -->
### `TODO(5.4)` — `Merge`
<!-- /lang -->

## Prove it
<!-- mode: read-only -->

<!-- lang: go -->
```bash
make test
make race
make run
```
<!-- /lang -->
