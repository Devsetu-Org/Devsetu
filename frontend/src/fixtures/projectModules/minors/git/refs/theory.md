## Where you are
<!-- mode: read-only -->

Objects never move. A **ref** is a name that points at a commit hash. `main` is a file. `HEAD` either names a branch (`ref: refs/heads/main`) or holds a raw hash (detached).

```plaintext
  .tinygit/HEAD              →  ref: refs/heads/main
  .tinygit/refs/heads/main   →  <40-hex>\n
```

> [!scope] This chapter's job
> Read and write refs, resolve symbolic HEAD, and implement `update-ref`. The
> worktree is untouched.

## Direct refs
<!-- mode: read-and-implement tasks:2.1 -->

A direct ref file contains one hex hash and a newline. Create parent directories as needed. Write temp-then-rename.

<!-- lang: go -->
### `TODO(2.1)` — `Read` and `Write`

In `internal/ref/ref.go`. `Read` resolves `name` with `safePath`, reads the file, trims whitespace, and parses a 40-hex `Hash`. `Write` creates parent dirs, writes `hash.Hex()+"\n"` to a `.tmp` file, then renames into place. `safePath` is given and rejects `..`.
<!-- /lang -->
<!-- lang: python -->
### `TODO(2.1)` — `read` and `write`

In `tinygit/ref/ref.py`. `read` resolves `name` with `safe_path`, reads the file, trims whitespace, and parses a 40-hex hash. `write` creates parent dirs, writes `hash.hex() + "\n"` to a `.tmp` file, then renames into place. `safe_path` is given and rejects `..`.
<!-- /lang -->
<!-- lang: cpp -->
### `TODO(2.1)` — `ReadRef` and `WriteRef`

In `src/ref/ref.cc`. `ReadRef` resolves `name` with `SafePath`, reads the file, trims whitespace, and parses a 40-hex `Hash`. `WriteRef` creates parent dirs, writes `Hex() + "\n"` to a `.tmp` file, then renames into place. `SafePath` is given and rejects `..`.
<!-- /lang -->

## Symbolic HEAD
<!-- mode: read-and-implement tasks:2.2 -->

If HEAD starts with `ref: `, it is symbolic. Otherwise it is detached. Resolve HEAD by following the symbolic name to a hash.

<!-- lang: go -->
### `TODO(2.2)` — `ReadHEAD` and `ResolveHEAD`

In `internal/ref/head.go`. `ReadHEAD` reads `.tinygit/HEAD`: a `ref: …` line sets `Symbolic`, otherwise parse a detached hash. `ResolveHEAD` returns that hash directly when detached, else `Read` on the symbolic target. `WriteSymbolicHEAD` and `WriteDetachedHEAD` are given.
<!-- /lang -->
<!-- lang: python -->
### `TODO(2.2)` — `read_head` and `resolve_head`

In `tinygit/ref/head.py`. `read_head` reads `.tinygit/HEAD`: a `ref: …` line sets `symbolic`, otherwise parse a detached hash. `resolve_head` returns that hash directly when detached, else `read` on the symbolic target. `write_symbolic_head` and `write_detached_head` are given.
<!-- /lang -->
<!-- lang: cpp -->
### `TODO(2.2)` — `ReadHEAD` and `ResolveHEAD`

In `src/ref/head.cc`. `ReadHEAD` reads `.tinygit/HEAD`: a `ref: …` line sets `symbolic`, otherwise parse a detached hash. `ResolveHEAD` returns that hash directly when detached, else `ReadRef` on the symbolic target. `WriteSymbolicHEAD` and `WriteDetachedHEAD` are given.
<!-- /lang -->

## update-ref
<!-- mode: read-and-implement tasks:2.3 -->

Update a ref to a new hash. When the old hash is non-zero, the current value must match (compare-and-swap). When the name is `HEAD` and HEAD is symbolic, update the branch tip instead of detaching.

<!-- lang: go -->
### `TODO(2.3)` — `UpdateRef`

In `internal/ref/update.go`. When `oldHash` is non-zero, `Read` the target and error if it does not match (compare-and-swap). For `name == "HEAD"`, if HEAD is symbolic, update that branch ref instead of writing a detached hash; if detached, compare against the stored hash when `oldHash` is set, then `WriteDetachedHEAD`. Otherwise `Write` the ref file to `newHash`.
<!-- /lang -->
<!-- lang: python -->
### `TODO(2.3)` — `update_ref`

In `tinygit/ref/update.py`. When `old_hash` is non-zero, `read` the target and error if it does not match (compare-and-swap). For `name == "HEAD"`, if HEAD is symbolic, update that branch ref instead of writing a detached hash; if detached, compare against the stored hash when `old_hash` is set, then `write_detached_head`. Otherwise `write` the ref file to `new_hash`.
<!-- /lang -->
<!-- lang: cpp -->
### `TODO(2.3)` — `UpdateRef`

In `src/ref/update.cc`. When `old_hash` is non-zero, `ReadRef` the target and error if it does not match (compare-and-swap). For `name == "HEAD"`, if HEAD is symbolic, update that branch ref instead of writing a detached hash; if detached, compare against the stored hash when `old_hash` is set, then `WriteDetachedHEAD`. Otherwise `WriteRef` to `new_hash`.
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
