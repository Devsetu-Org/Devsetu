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

Build a nested map, then recursively `PutTree`.
<!-- /lang -->

## commit
<!-- mode: read-and-implement tasks:4.2 -->

Parent is the current `ResolveHEAD` when it exists (first commit has none). Author line includes a unix timestamp and `+0000`.

<!-- lang: go -->
### `TODO(4.2)` — `Commit`

`PutCommit` then `UpdateRef(r, "HEAD", h, Zero)`.
<!-- /lang -->

## checkout
<!-- mode: read-and-implement tasks:4.3 -->

Flatten the target tree, run `safetyCheck` (given), write blobs, rebuild the index, detach HEAD at the commit. `CheckoutBranch` is given and restores a symbolic HEAD after your `Checkout`.

<!-- lang: go -->
### `TODO(4.3)` — `Checkout`

Remove tracked paths that are absent from the target. Do not skip `safetyCheck`.
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
