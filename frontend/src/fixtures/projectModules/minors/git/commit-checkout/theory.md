## Where you are
<!-- mode: read-only -->

`write-tree` turns the index into a nested tree of objects. `commit` wraps that tree with a parent and a message, then moves HEAD. `checkout` materializes a commit's tree into the worktree and refreshes the index.

```plaintext
  index  →  write-tree  →  tree hash
         →  commit      →  commit hash → update-ref HEAD
  commit →  checkout    →  files on disk + index
```

> [!scope] This chapter's job
> Nested trees from paths like `dir/a.txt`, first-parent commits, and a checkout
> that refuses to clobber dirty tracked files.

## write-tree
<!-- mode: read-and-implement tasks:4.1 -->

Split each index path on `/`. Directories become `040000` tree objects; files keep their blob hashes.

<!-- lang: go -->
### `TODO(4.1)` — `WriteTree`

In `internal/worktree/write_tree.go`. Load the index. Split each `Path` on `/` into a nested `map[string]any` (leaf values are index entries, interior nodes are maps). Walk each level in sorted name order: files become `TreeEntry` blobs; directories recurse with `PutTree`. Return the root tree hash. An empty index yields an empty tree.
<!-- /lang -->
<!-- lang: python -->
### `TODO(4.1)` — `write_tree`

In `tinygit/worktree/write_tree.py`. Load the index. Split each `path` on `/` into a nested dict (leaf values are index entries, interior nodes are dicts). Walk each level in sorted name order: files become tree blob entries; directories recurse with `put_tree`. Return the root tree hash. An empty index yields an empty tree.
<!-- /lang -->
<!-- lang: cpp -->
### `TODO(4.1)` — `WriteTree`

In `src/worktree/write_tree.cc`. Load the index. Split each path on `/` into a nested map (leaf values are index entries, interior nodes are maps). Walk each level in sorted name order: files become tree blob entries; directories recurse with `PutTree`. Return the root tree hash. An empty index yields an empty tree.
<!-- /lang -->

## commit
<!-- mode: read-and-implement tasks:4.2 -->

Parent is the current resolved HEAD when it exists (first commit has none). Author line includes a unix timestamp and `+0000`.

<!-- lang: go -->
### `TODO(4.2)` — `Commit`

In `internal/worktree/commit.go`. Call `WriteTree`, resolve the current HEAD as the parent when it exists (first commit has none), build author/committer lines with unix time and `+0000`, require a non-empty message ending with newline via `PutCommit`, then `UpdateRef(r, "HEAD", h, object.Zero)` so HEAD advances to the new snapshot.
<!-- /lang -->
<!-- lang: python -->
### `TODO(4.2)` — `commit`

In `tinygit/worktree/commit.py`. Call `write_tree`, resolve the current HEAD as the parent when it exists (first commit has none), build author/committer lines with unix time and `+0000`, require a non-empty message ending with newline via `put_commit`, then `update_ref(r, "HEAD", h, ZERO)` so HEAD advances to the new snapshot.
<!-- /lang -->
<!-- lang: cpp -->
### `TODO(4.2)` — `CommitWorktree`

In `src/worktree/commit.cc`. Call `WriteTree`, resolve the current HEAD as the parent when it exists (first commit has none), build author/committer lines with unix time and `+0000`, require a non-empty message ending with newline via `PutCommit`, then `UpdateRef(r, "HEAD", h, kZero)` so HEAD advances to the new snapshot.
<!-- /lang -->

## checkout
<!-- mode: read-and-implement tasks:4.3 -->

Flatten the target tree, run the given safety check, write blobs, rebuild the index, detach HEAD at the commit. Checking out a branch is given and restores a symbolic HEAD after your checkout.

<!-- lang: go -->
### `TODO(4.3)` — `Checkout`

In `internal/worktree/checkout.go`. Flatten the target commit's tree to `path → blob hash`. Run `safetyCheck` before touching files (refuse when a tracked worktree file would be overwritten and differs from both index and target). Delete index paths missing from the target. For each target path, write blob bytes, mkdir parents, rebuild the index, and `WriteDetachedHEAD` at the commit hash.
<!-- /lang -->
<!-- lang: python -->
### `TODO(4.3)` — `checkout`

In `tinygit/worktree/checkout.py`. Flatten the target commit's tree to `path → blob hash`. Run `safety_check` before touching files (refuse when a tracked worktree file would be overwritten and differs from both index and target). Delete index paths missing from the target. For each target path, write blob bytes, mkdir parents, rebuild the index, and detach HEAD at the commit hash.
<!-- /lang -->
<!-- lang: cpp -->
### `TODO(4.3)` — `Checkout`

In `src/worktree/checkout.cc`. Flatten the target commit's tree to `path → blob hash`. Run `SafetyCheck` before touching files (refuse when a tracked worktree file would be overwritten and differs from both index and target). Delete index paths missing from the target. For each target path, write blob bytes, mkdir parents, rebuild the index, and detach HEAD at the commit hash.
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
