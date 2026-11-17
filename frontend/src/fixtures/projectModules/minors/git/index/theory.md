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

In `internal/index/codec.go`. `Encode` sorts entries by `Path`, writes `TINYIDX 1\n`, then one line per entry: `path\tmode\thex\n`. Reject empty or tab/newline paths. `Decode` parses the header magic and version, reads tab-separated lines into `Entry` values, and errors on bad headers or hashes.
<!-- /lang -->
<!-- lang: python -->
### `TODO(3.1)` — `encode` and `decode`

In `tinygit/index/codec.py`. `encode` sorts entries by `path`, writes `TINYIDX 1\n`, then one line per entry: `path\tmode\thex\n`. Reject empty or tab/newline paths. `decode` parses the header magic and version, reads tab-separated lines into entries, and errors on bad headers or hashes.
<!-- /lang -->
<!-- lang: cpp -->
### `TODO(3.1)` — `EncodeIndex` and `DecodeIndex`

In `src/index/codec.cc`. `EncodeIndex` sorts entries by `path`, writes `TINYIDX 1\n`, then one line per entry: `path\tmode\thex\n`. Reject empty or tab/newline paths. `DecodeIndex` parses the header magic and version, reads tab-separated lines into entries, and errors on bad headers or hashes.
<!-- /lang -->

## add
<!-- mode: read-and-implement tasks:3.2 -->

Read the file from the worktree, store a blob, upsert the index entry with mode `100644`, save.

<!-- lang: go -->
### `TODO(3.2)` — `Add`

In `internal/index/add.go`. Clean `rel` to a slash-separated repo-relative path; reject `..` and `.`. Read the worktree file, `PutBlob` the bytes, load the index, upsert `Entry{Path: rel, Mode: file mode, Hash: h}`, and `Save`. An existing path is replaced in place.
<!-- /lang -->
<!-- lang: python -->
### `TODO(3.2)` — `add`

In `tinygit/index/add.py`. Clean `rel` to a slash-separated repo-relative path; reject `..` and `.`. Read the worktree file, `put_blob` the bytes, load the index, upsert the entry with mode `100644`, and `save`. An existing path is replaced in place.
<!-- /lang -->
<!-- lang: cpp -->
### `TODO(3.2)` — `Add`

In `src/index/add.cc`. Clean `rel` to a slash-separated repo-relative path; reject `..` and `.`. Read the worktree file, `PutBlob` the bytes, load the index, upsert the entry with file mode, and `Save`. An existing path is replaced in place.
<!-- /lang -->

## status
<!-- mode: read-and-implement tasks:3.3 -->

- **Staged**: index hash differs from HEAD's tree (or path only on one side).
- **Modified**: worktree bytes hash to a different blob than the index.
- **Untracked**: file under the root, not in the index (skip `.tinygit`).

Helpers that build the HEAD file map and list untracked paths are given.

<!-- lang: go -->
### `TODO(3.3)` — `Status`

In `internal/index/status.go`. Build the HEAD file map (given). **Staged**: index path missing from HEAD or hash differs from HEAD. **Modified**: worktree bytes hash with `HashOf(EncodeHeader("blob", data))` (same as `PutBlob`) differs from the index, or the tracked file is missing on disk. **Untracked**: use the given `listUntracked` helper. Sort each bucket before returning.
<!-- /lang -->
<!-- lang: python -->
### `TODO(3.3)` — `status`

In `tinygit/index/status.py`. Build the HEAD file map (given). **Staged**: index path missing from HEAD or hash differs from HEAD. **Modified**: worktree bytes hash with `hash_of(encode_header("blob", data))` (same as `put_blob`) differs from the index, or the tracked file is missing on disk. **Untracked**: use the given helper. Sort each bucket before returning.
<!-- /lang -->
<!-- lang: cpp -->
### `TODO(3.3)` — `Status`

In `src/index/status.cc`. Build the HEAD file map (given). **Staged**: index path missing from HEAD or hash differs from HEAD. **Modified**: worktree bytes hash with `HashOf(EncodeHeader("blob", data))` (same as `PutBlob`) differs from the index, or the tracked file is missing on disk. **Untracked**: use the given helper. Sort each bucket before returning.
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
