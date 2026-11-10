## Where you are
<!-- mode: read-only -->

The **index** is the next commit, half-built: a table of `(path, mode, hash)`. `add` hashes a worktree file into a blob and records the path. `status` compares HEAD, index, and worktree.

tinygit uses a small custom format (not Git's binary index):

```plaintext
  TINYIDX 1
  path<TAB>mode<TAB>hash
```

> [!scope] This chapter's job
> Encode/decode the index, implement `add`, and report staged / modified /
> untracked. No `commit` yet.

## Codec
<!-- mode: read-and-implement tasks:3.1 -->

Sort entries by path. Load / Save / Set are given and call your codec.

<!-- lang: go -->
### `TODO(3.1)` — `Encode` and `Decode`

In `internal/index/codec.go`.
<!-- /lang -->
<!-- lang: python -->
### `TODO(3.1)` — `encode` and `decode`

In `tinygit/index/codec.py`.
<!-- /lang -->
<!-- lang: cpp -->
### `TODO(3.1)` — `EncodeIndex` and `DecodeIndex`

In `src/index/codec.cc`.
<!-- /lang -->

## add
<!-- mode: read-and-implement tasks:3.2 -->

Read the file from the worktree, store a blob, upsert the index entry with mode `100644`, save.

<!-- lang: go -->
### `TODO(3.2)` — `Add`

Reject paths containing `..`. Use slash-separated repo-relative paths.
<!-- /lang -->
<!-- lang: python -->
### `TODO(3.2)` — `add`

Reject paths containing `..`. Use slash-separated repo-relative paths.
<!-- /lang -->
<!-- lang: cpp -->
### `TODO(3.2)` — `Add`

Reject paths containing `..`. Use slash-separated repo-relative paths.
<!-- /lang -->

## status
<!-- mode: read-and-implement tasks:3.3 -->

- **Staged**: index hash differs from HEAD's tree (or path only on one side).
- **Modified**: worktree bytes hash to a different blob than the index.
- **Untracked**: file under the root, not in the index (skip `.tinygit`).

Helpers that build the HEAD file map and list untracked paths are given.

<!-- lang: go -->
### `TODO(3.3)` — `Status`

Compare with `HashOf(EncodeHeader("blob", data))`, the same hash `PutBlob` uses.
<!-- /lang -->
<!-- lang: python -->
### `TODO(3.3)` — `status`

Compare with `hash_of(encode_header("blob", data))`, the same hash `put_blob` uses.
<!-- /lang -->
<!-- lang: cpp -->
### `TODO(3.3)` — `Status`

Compare with `HashOf(EncodeHeader("blob", data))`, the same hash `PutBlob` uses.
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
