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
> Log walk, tree diff, merge-base, and a file-level three-way merge with
> fast-forward, clean merge, and conflict fixtures.

## log
<!-- mode: read-and-implement tasks:5.1 -->

<!-- lang: go -->
### `TODO(5.1)` — `LogWalk`

In `internal/diff/log.go`. Starting at `tip`, load each commit and append it to the result. Follow only `Parents[0]` until it is missing or zero. Return newest-first order. Track a `seen` set and stop if a commit repeats so a malformed graph cannot loop forever.
<!-- /lang -->
<!-- lang: python -->
### `TODO(5.1)` — `log_walk`

In `tinygit/diff/log.py`. Starting at `tip`, load each commit and append it to the result. Follow only `parents[0]` until it is missing or zero. Return newest-first order. Track a `seen` set and stop if a commit repeats so a malformed graph cannot loop forever.
<!-- /lang -->
<!-- lang: cpp -->
### `TODO(5.1)` — `LogWalk`

In `src/diff/log.cc`. Starting at `tip`, load each commit and append it to the result. Follow only `parents[0]` until it is missing or zero. Return newest-first order. Track a `seen` set and stop if a commit repeats so a malformed graph cannot loop forever.
<!-- /lang -->

## tree diff
<!-- mode: read-and-implement tasks:5.2 -->

Flatten both trees. Status `A` / `M` / `D`. Sort by path. Flatten is given.

<!-- lang: go -->
### `TODO(5.2)` — `TreeDiff`

In `internal/diff/diff.go`. `flatten` (given) maps each tree hash to `path → blob hash`. Flatten trees `a` and `b`, union their path sets, then walk paths in sorted order. Only in the left map → status `D` with `Old` set. Only in the right → `A` with `New` set. In both with different hashes → `M` with both hashes. Omit paths that are identical. Return the sorted `[]Change`.
<!-- /lang -->
<!-- lang: python -->
### `TODO(5.2)` — `tree_diff`

In `tinygit/diff/diff.py`. `flatten` (given) maps each tree hash to `path → blob hash`. Flatten trees `a` and `b`, union their path sets, then walk paths in sorted order. Only in the left map → status `D` with `old` set. Only in the right → `A` with `new` set. In both with different hashes → `M` with both hashes. Omit paths that are identical. Return the sorted list of changes.
<!-- /lang -->
<!-- lang: cpp -->
### `TODO(5.2)` — `TreeDiff`

In `src/diff/diff.cc`. `Flatten` (given) maps each tree hash to `path → blob hash`. Flatten trees `a` and `b`, union their path sets, then walk paths in sorted order. Only in the left map → status `D` with `old` set. Only in the right → `A` with `new` set. In both with different hashes → `M` with both hashes. Omit paths that are identical. Return the sorted vector of changes.
<!-- /lang -->

## merge-base
<!-- mode: read-and-implement tasks:5.3 -->

Mark every ancestor of `a`. Walk `b`; the first commit already marked is a merge base.

<!-- lang: go -->
### `TODO(5.3)` — `MergeBase`

In `internal/merge/base.go`. BFS from commit `a`: mark every reachable commit (all parents) in an `ancestors` set. BFS from `b`: the first marked commit you reach is the merge base; return it. If `b`'s walk finishes with no hit, return zero. Skip zero hashes and avoid revisiting nodes in either walk.
<!-- /lang -->
<!-- lang: python -->
### `TODO(5.3)` — `merge_base`

In `tinygit/merge/base.py`. BFS from commit `a`: mark every reachable commit (all parents) in an `ancestors` set. BFS from `b`: the first marked commit you reach is the merge base; return it. If `b`'s walk finishes with no hit, return zero. Skip zero hashes and avoid revisiting nodes in either walk.
<!-- /lang -->
<!-- lang: cpp -->
### `TODO(5.3)` — `MergeBase`

In `src/merge/base.cc`. BFS from commit `a`: mark every reachable commit (all parents) in an `ancestors` set. BFS from `b`: the first marked commit you reach is the merge base; return it. If `b`'s walk finishes with no hit, return zero. Skip zero hashes and avoid revisiting nodes in either walk.
<!-- /lang -->

## three-way merge
<!-- mode: read-and-implement tasks:5.4 -->

If base equals theirs, already up to date. If base equals ours, fast-forward. Otherwise, for each path take ours, theirs, or both; on conflict call the given conflict writer with the marker constants.

A clean merge creates a commit with **two parents** and updates HEAD.

<!-- lang: go -->
### `TODO(5.4)` — `Merge`

In `internal/merge/merge.go`. Resolve `ours` from HEAD and `theirs` from `refs/heads/` + branch; `MergeBase` is the three-way base. Base equals theirs → already up to date. Base equals ours → fast-forward: `worktree.Checkout(theirs)` and move the symbolic branch ref if HEAD is symbolic. Otherwise flatten base, ours, and theirs trees; for each sorted path apply the file-level rules from the section (keep one side when unchanged, take the changed side when only one side moved from base, call `writeConflict` with `MarkerOurs` / `MarkerSep` / `MarkerTheirs` when both diverged). On conflicts, save the partial index and return the path list. On success, `WriteTree`, `PutCommit` with **two parents**, and `UpdateRef(r, "HEAD", h, object.Zero)`.
<!-- /lang -->
<!-- lang: python -->
### `TODO(5.4)` — `merge`

In `tinygit/merge/merge.py`. Resolve `ours` from HEAD and `theirs` from `refs/heads/` + branch; `merge_base` is the three-way base. Base equals theirs → already up to date. Base equals ours → fast-forward: `checkout(theirs)` and move the symbolic branch ref if HEAD is symbolic. Otherwise flatten base, ours, and theirs trees; for each sorted path apply the file-level rules from the section (keep one side when unchanged, take the changed side when only one side moved from base, call the given conflict writer with the marker constants when both diverged). On conflicts, save the partial index and return the path list. On success, `write_tree`, `put_commit` with **two parents**, and `update_ref(r, "HEAD", h, ZERO)`.
<!-- /lang -->
<!-- lang: cpp -->
### `TODO(5.4)` — `Merge`

In `src/merge/merge.cc`. Resolve `ours` from HEAD and `theirs` from `refs/heads/` + branch; `MergeBase` is the three-way base. Base equals theirs → already up to date. Base equals ours → fast-forward: `Checkout(theirs)` and move the symbolic branch ref if HEAD is symbolic. Otherwise flatten base, ours, and theirs trees; for each sorted path apply the file-level rules from the section (keep one side when unchanged, take the changed side when only one side moved from base, call the given conflict writer with the marker constants when both diverged). On conflicts, save the partial index and return the path list. On success, `WriteTree`, `PutCommit` with **two parents**, and `UpdateRef(r, "HEAD", h, kZero)`.
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
<!-- lang: python -->
```bash
make test
make run
```
<!-- /lang -->
<!-- lang: cpp -->
```bash
make test
make asan
make run
```
<!-- /lang -->
