## Where you are
<!-- mode: read-only -->

Git stores every version of every file as a **hashed object**. Same bytes, same hash. Change one byte and you get a new object; the old one stays.

```plaintext
  file bytes  →  blob
  directory   →  tree of (mode, name, hash)
  snapshot    →  commit (tree + parents + message)
```

This chapter builds the object layer only: hash, store under `.tinygit/objects/aa/…`, and round-trip blob, tree, and commit.

> [!scope] This chapter's job
> No branches, no index, no worktree checkout. When you finish, `hash-object` and
> `cat-file` round-trip fixed fixtures through zlib loose objects.

## Content addressing
<!-- mode: read-and-implement tasks:1.1 -->

The object id is SHA-1 of the **header plus content**, not of the file alone. The header is `type` + space + decimal size + NUL, then the raw content bytes.

```plaintext
  blob 6\0hello\n     →  sha1 →  ce0136… (Git's hash for hello\n)
```

<!-- lang: go -->
### `TODO(1.1)` — `HashOf`

In `internal/object/hash.go`: compute `sha1.Sum(data)`, copy into a `Hash`, return it. `Hex` and `ParseHex` are already written.
<!-- /lang -->
<!-- lang: python -->
### `TODO(1.1)` — `hash_of`

In `tinygit/object/hash.py`: return `Hash(hashlib.sha1(data).digest())`. `hex` and `parse_hex` are already written.
<!-- /lang -->
<!-- lang: cpp -->
### `TODO(1.1)` — `HashOf`

In `src/object/hash.cc`: SHA-1 `data` into a `Hash` (20 bytes). `Hex` and `ParseHex` are already written.
<!-- /lang -->

## Loose object store
<!-- mode: read-and-implement tasks:1.2 -->

On disk, the object is **zlib-compressed**. Path is `objects/` + first two hex digits + `/` + the rest. Write with a temp file and rename so a crash does not leave a half object.

<!-- lang: go -->
`EncodeHeader` / `SplitHeader` in `header.go` are given. Your `Put` and `Get` call them.

### `TODO(1.2)` — `Store.Put` and `Store.Get`

`Put`: build `raw := EncodeHeader(typ, content)`, `h := HashOf(raw)`, skip if the file exists, otherwise zlib-compress and write under `pathFor(h)`.

`Get`: read, inflate, `SplitHeader`, and check `HashOf(raw) == h`.
<!-- /lang -->
<!-- lang: python -->
`encode_header` / `split_header` in `header.py` are given. Your `Store.put` and `Store.get` call them.

### `TODO(1.2)` — `Store.put` and `Store.get`

`put`: build `raw = encode_header(typ, content)`, `h = hash_of(raw)`, skip if the file exists, otherwise zlib-compress and write under `path_for(h)` via temp+rename.

`get`: read, `zlib.decompress`, `split_header`, and check `hash_of(raw) == h`.
<!-- /lang -->
<!-- lang: cpp -->
`EncodeHeader` / `SplitHeader` in `header.cc` are given. Your `Store::Put` and `Store::Get` call them. Link with `-lz`.

### `TODO(1.2)` — `Store::Put` and `Store::Get`

`Put`: build `raw = EncodeHeader(typ, content)`, `h = HashOf(raw)`, skip if the file exists, otherwise zlib-compress and write under `PathFor(h)` via temp+rename.

`Get`: read, inflate, `SplitHeader`, and check `HashOf(raw) == h`.
<!-- /lang -->

## Blob, tree, commit
<!-- mode: read-and-implement tasks:1.3,1.4,1.5 -->

A **blob** body is the file bytes. A **tree** body is sorted entries: `mode name\0` + 20 raw hash bytes. Modes you need: `100644` (file) and `040000` (subtree). A **commit** body is text headers (`tree`, `parent`, `author`, `committer`) then a blank line and the message.

<!-- lang: go -->
### `TODO(1.3)` — `PutBlob` / `GetBlob`

Thin wrappers around `Put`/`Get` with type `"blob"`. Reject a non-blob on read.

### `TODO(1.4)` — `EncodeTree` / `DecodeTree`

Sort by name. Encode and parse the Git tree format. `PutTree` / `GetTree` are given.

### `TODO(1.5)` — `EncodeCommit` / `DecodeCommit`

Require a tree and author. Default committer to author. Ensure the message ends with a newline. `PutCommit` / `GetCommit` are given.
<!-- /lang -->
<!-- lang: python -->
### `TODO(1.3)` — `put_blob` / `get_blob`

Thin wrappers around `put`/`get` with type `"blob"`. Reject a non-blob on read.

### `TODO(1.4)` — `encode_tree` / `decode_tree`

Sort by name. Encode and parse the Git tree format. `put_tree` / `get_tree` are given.

### `TODO(1.5)` — `encode_commit` / `decode_commit`

Require a tree and author. Default committer to author. Ensure the message ends with a newline. `put_commit` / `get_commit` are given.
<!-- /lang -->
<!-- lang: cpp -->
### `TODO(1.3)` — `PutBlob` / `GetBlob`

Thin wrappers around `Put`/`Get` with type `"blob"`. Reject a non-blob on read.

### `TODO(1.4)` — `EncodeTree` / `DecodeTree`

Sort by name. Encode and parse the Git tree format. `PutTree` / `GetTree` are given.

### `TODO(1.5)` — `EncodeCommit` / `DecodeCommit`

Require a tree and author. Default committer to author. Ensure the message ends with a newline. `PutCommit` / `GetCommit` are given.
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

> [!check] Before you move on
> 1. The hash covers header + content, not the zlib wrapper.
> 2. Loose objects live at `objects/aa/bbcc…`.
> 3. Trees sort by name; commits point at one tree and zero or more parents.
