## Where you are
<!-- mode: read-only -->

The engine writes durably and caches pages. It can insert and look up. It cannot forget: `Delete` returns "not built yet", pages are never given back, and there is no way to walk the keys in order.

```plaintext
            Put / Delete / Get / Scan
                       │
              ┌────────▼────────┐
  ch 2, 5     │    B+ tree       │ ◀──── you are here
              └────────┬────────┘
              ┌────────▼────────┐
  ch 4        │   Buffer pool    │  done
              └──┬───────────┬──┘
                 ▼           ▼
             data.db      wal.log   (ch 1, ch 3: done)
```

> [!scope] This chapter's job
> Delete with borrow and merge so the tree stays full and freed pages go back to the
> freelist, and a range scan that follows the leaf links. When the tests pass, the whole
> public API works and survives a crash.

## Deleting from a leaf
<!-- mode: read-and-implement tasks:5.1 -->

### Easy at the bottom, complicated on the way back

Removing a key from a leaf is a slice delete. The trouble is what comes after. Delete enough keys and a leaf is nearly empty: a page of 4 KiB holding one entry. A tree full of those wastes space, and its height no longer reflects how much data it holds.

B-trees therefore keep a **minimum fill**: no non-root page may drop below a threshold. (Textbooks say "at least half the keys". This engine's pages hold variable-size entries, so it says "at least a quarter of the page, in bytes".) When a delete pushes a page under it, the page must **borrow** an entry from a sibling or **merge** with it.

```plaintext
  delete("f"):

  parent  [ ... "g" ... ]
             │       │
      leaf [a b ]  leaf [g h i j k]     leaf [a b] is now underfull
```

The page that became underfull cannot fix itself, because it needs its sibling and its sibling hangs off the parent. So the delete works recursively, like insert did in chapter 2: the leaf removes the key and reports "I am underfull" to its caller, and the parent does the repair.

```plaintext
  delete(root)
     delete(child 2)
        delete(leaf)            removes the key, returns (found, underfull=true)
     child 2 sees underfull ──▶ rebalance(child 2, leaf's index)
     child 2 may now be underfull itself ──▶ returns underfull to the root
```

A missing key is the easy case: nothing is written, nothing is reported.

<!-- lang: go -->
### `TODO(5.1)` — `delete`

In `internal/btree/delete.go`. `delete(no, key)` returns `(found, under bool, err error)`:

1. `n, err := t.load(no)`.
2. Leaf: `i, ok := n.leafIndex(key)`. If absent, return `false, false, nil` **without writing anything**. Otherwise `n.removeLeafAt(i)` (given), `t.store(no, n)`, and return `true, n.underfull(), nil`.
3. Internal: `i := n.childIndex(key)` and recurse into `n.children[i]`. If the key was not found, or the child is not underfull, return the result as is: this page did not change. Otherwise `t.rebalance(no, n, i)` (task 5.2) repairs the child and rewrites `n`, and you return `true, n.underfull(), nil`.

`underfull` is given in `balance.go`.
<!-- /lang -->

## Borrow or merge
<!-- mode: read-and-implement tasks:5.2 -->

### Two adjacent siblings, two outcomes

An underfull child has a neighbor (the parent's other children are next to it in key order). Take the pair: the underfull page and one neighbor, with the parent's separator between them. There are two ways to repair it:

| Situation | Repair | What happens to the parent |
| --- | --- | --- |
| The pair fits in one page | **Merge**: move everything into the left page, **free** the right page | the separator and the right child pointer are removed; the parent may become underfull |
| The pair does not fit | **Borrow**: spread the entries about evenly between the two pages | the separator is **replaced** with the new boundary; the parent keeps its size |

```plaintext
  merge:    [a b] "g" [g h]            ──▶   [a b g h]          page freed, separator gone

  borrow:   [a b] "g" [g h i j k l]    ──▶   [a b g h] "i" [i j k l]   separator replaced
```

Merge is the only operation that **frees pages**, and a merge can underfill the parent, so underflow travels up exactly as splits travel up in insert. Borrow ends the repair: no page count changes.

The separator is handled differently for the two kinds of page, as in the split:

| | Leaf | Internal |
| --- | --- | --- |
| Merge | the old separator is **dropped** (every key is in the leaves already) | the old separator is **pulled down** between the two key lists |
| New separator after a borrow | a copy of the right page's first key | the key that moves up from the pooled keys |

The helpers in `balance.go` (given) do that arithmetic: `canMerge`, `mergeNodes`, `redistribute`, and `removeChild`. Your job is the orchestration: which pair, which repair, which pages to write and free.

> [!warn] Free the right page, once
> A merge frees exactly one page: the right one. Free the wrong page, or free it before
> the merged page is stored, or free it twice (the freelist then loops, as chapter 1
> warned), and the tree and the freelist share a page. The test file's in-memory store
> fails loudly on any use of a freed page.

<!-- lang: go -->
### `TODO(5.2)` — `rebalance`

In `internal/btree/delete.go`. `rebalance(parentNo, parent, i)` repairs child `i` of `parent`, which was loaded from page `parentNo`:

1. Pick the pair: `li := i`, or `li = i - 1` when `i > 0` (prefer the left sibling; the leftmost child pairs with its right one). `leftNo, rightNo := parent.children[li], parent.children[li+1]`, `sep := parent.keys[li]`. Load both nodes.
2. `canMerge(left, right, sep)`: `mergeNodes(left, right, sep)`, store `left` at `leftNo`, `t.io.Free(rightNo)`, and `parent.removeChild(li)`.
3. Otherwise `parent.keys[li] = redistribute(left, right, sep)` and store both pages.
4. In both cases finish with `t.store(parentNo, parent)`.
<!-- /lang -->

## Shrinking the tree
<!-- mode: read-and-implement tasks:5.3 -->

### The root is special

Merges can leave the **root** with a single child and no separators. That is a pointless level: every lookup passes through a page that only says "go to child 0". The fix is the mirror image of chapter 2's growth:

- an **internal root with no keys**: make its only child the new root and free the old root page. The tree is one level shorter.
- a **leaf root with no keys**: the tree is empty. Set the root to 0 and free the page.

```plaintext
  root [ ]                         root = child
    │               ──────▶        (old root page freed)
  child [ ... ]
```

This is the only way a B+ tree gets shorter, and like growth it happens at the top, so every leaf stays at the same depth. It can repeat: after a root collapse the new root could itself be a keyless internal page.

<!-- lang: go -->
### `TODO(5.3)` — `Delete`

In `internal/btree/delete.go`:

1. Root 0 (or an empty key): return `false, nil`.
2. `found, _, err := t.delete(root, key)`. A miss or an error returns at once. The "underfull" flag of the root is ignored: a root may be as small as it likes.
3. Shrink the root in a loop. Load the root. A leaf with no keys: `t.io.SetRoot(0)`. An internal node with no keys: `t.io.SetRoot(n.children[0])`. Either way `t.io.Free(oldRoot)` **after** `SetRoot`, and loop again. Anything else ends the loop.

Return `true, nil`.
<!-- /lang -->

> [!tip] What a real engine does here
> Many production B-trees do not merge on delete at all. They leave pages sparse and
> merge lazily in a background vacuum (Postgres's `VACUUM` removes dead index entries
> and recycles empty pages; it does not rebalance eagerly), because a merge on the write
> path costs locking and I/O. Doing it inline keeps this engine small, and the tests
> can then check that the tree really shrinks.

## Range scans along the leaves
<!-- mode: read-and-implement tasks:5.4 -->

### The reason leaves are linked

A B+ tree keeps all the data in leaves, and every leaf knows its right neighbor. So an ordered scan needs the tree only **once**: to find the leaf where the range starts. From there it never goes back up.

```plaintext
  Scan("m", "t")

  descend:       root ─▶ internal ─▶ leaf [k m p]        1 read per level, once
  then follow:   leaf [k m p] ─▶ leaf [q r s] ─▶ leaf [t v w]     1 read per leaf
                      ▲ skip k            end at "t" ──▶ stop
```

This is the other half of why databases use B+ trees rather than B-trees (which scatter data across internal nodes): `SELECT ... WHERE id BETWEEN 100 AND 200` is one descent plus a sequential walk. An LSM tree must merge every table to do the same.

The range is **half-open**: `start` inclusive, `end` exclusive. A nil `start` means from the first key; a nil `end`, to the last.

<!-- lang: go -->
### `TODO(5.4)` — `Scan`

In `internal/db/scan.go`. `Scan` holds the read lock already, so readers run alongside each other.

1. `tree := btree.New(d.store)`, `no, err := tree.SeekLeaf(start)` (given; 0 for an empty tree, and a nil `start` finds the leftmost leaf).
2. While `no != 0`: `leaf, err := tree.ReadLeaf(no)` (given). Find the first key `>= start` with `sort.Search` and `bytes.Compare`.
3. From there, for each key: if `end != nil` and the key is `>= end`, return `nil`. Call `fn(key, value)`; if it returns `false`, return `nil`.
4. `no = leaf.Next`.

`TestScanWalksTheLeafChain` counts page reads: a scan that goes back to the root for every leaf fails it. You will need to import `bytes`, `sort`, and the `btree` package.

> [!scope] Callbacks and locks
> `fn` runs while `Scan` holds the read lock, so it must not call `Put` or `Delete` (they
> would wait for a lock their own caller holds). The keys and values it receives are
> private copies, so keeping them is safe.
<!-- /lang -->

## Prove it
<!-- mode: read-only -->

<!-- lang: go -->
```bash
make test     # every acceptance test
make race     # the same tests with the race detector
make run      # a REPL that keeps its data in ./data
```
<!-- /lang -->

Try the whole engine:

```plaintext
> put order:2 paid
OK
> put order:1 pending
OK
> put order:3 shipped
OK
> scan order:1 order:3
order:1  "pending"
order:2  "paid"
> del order:2
OK
> scan
order:1  "pending"
order:3  "shipped"
```

Load a few thousand keys, then delete most of them and watch `stats`: the height drops, the leaf count falls, and `free` rises as merged pages return to the freelist. Insert again and `pages` does not grow, because the freelist is used first.

The tests are strict about this. They run random inserts, overwrites, and deletes against a plain Go map and check the tree's invariants every few hundred operations. They delete everything and require an empty tree with every page freed. They crash and reopen, and they scan while another goroutine writes.

> [!check] Before you finish
> 1. Delete removes from a leaf and reports "underfull"; the parent repairs it.
> 2. Merge frees a page and can underfill the parent; borrow only moves entries and replaces the separator.
> 3. The tree shrinks only at the root, so it stays balanced.
> 4. A scan descends once and then follows leaf links.

### What you built

A storage engine with the same shape as the one inside Postgres, SQLite, and InnoDB: a pager with a freelist and checksums, a B+ tree of pages, a write-ahead log with crash recovery, and a buffer pool with clock eviction that never writes a page ahead of its log. The next chapter measures it against the LSM tree you built in the other minor, with the same workloads and the same API.
