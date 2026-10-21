## Where you are
<!-- mode: read-only -->

Chapter 1 built the pager: an array of 4 KiB checksummed pages with a freelist. It hands out page numbers and stores whatever bytes you give it. It has no idea what the bytes mean.

```plaintext
            Put / Get
                │
       ┌────────▼────────┐
  ch 2 │    B+ tree       │ ◀──── you are here
       └────────┬────────┘
       ┌────────▼────────┐
  ch 1 │      Pager       │  done
       └─────────────────┘
```

This chapter gives the bytes a meaning: each page is a **node** of a **B+ tree**, and child pointers are page numbers.

> [!scope] This chapter's job
> Search, insert, and split. `Put` and `Get` work and survive a clean `Close`. There is
> no log yet (a crash mid-write can tear the tree), and no delete or range scan.

## Shape of a B+ tree
<!-- mode: read-only -->

### Two kinds of page

| | Internal page | Leaf page |
| --- | --- | --- |
| Holds | separator keys and child page numbers | keys and values |
| A lookup | picks one child and moves on | finds the key, or proves it is absent |
| Links | children | the next leaf to the right |

Every key lives in exactly one leaf. Internal pages carry only **separators**: copies of keys that say where to go. A separator is a sign on a fork in the road, not a piece of data.

```plaintext
                          ┌─────────────────────┐
              internal    │      "m"    "t"     │
                          └───┬──────┬───────┬──┘
                    keys < m  │      │       │  keys >= t
                              │      │ m <= keys < t
                  ┌───────────▼┐  ┌──▼─────────┐  ┌▼───────────┐
        leaves    │ a  c  f  k │─▶│ m  p  r    │─▶│ t  w  z    │─▶ 0
                  └────────────┘  └────────────┘  └────────────┘
                   next leaf ──▶
```

An internal page with `k` separators has `k + 1` children. `children[i]` covers every key below `keys[i]`; `children[i+1]` covers every key at or above it. A key **equal** to a separator goes right.

### Why it is short

A page holds about 4 KiB, so an internal page holds dozens of separators. Each level multiplies the reach by that factor. A tree of a million keys is three or four levels tall, and a lookup reads **one page per level**. That is the whole point of the design: the number of disk reads for a lookup is the height, and the height grows like `log` base *fan-out*.

> [!tip] Read amplification, B-tree style
> A lookup in this tree touches `height` pages: 3 or 4 for most real databases, and the
> top levels are almost always in memory (chapter 4). Compare chapter 4 of the LSM
> minor, where one lookup may read a block from every table.

### What a page looks like on disk

<!-- lang: go -->
`node.go` (given) decodes a page into a `node` and encodes it back. You work with the decoded struct:

```go
type node struct {
	leaf     bool
	keys     [][]byte
	vals     [][]byte       // leaf only: vals[i] belongs to keys[i]
	children []pager.PageNo // internal only: len(keys)+1 pages
	next     pager.PageNo   // leaf only: right sibling, 0 for none
}
```

Keys and values in a decoded node are private copies, so you can keep them. `Tree.load(no)` reads and decodes a page; `Tree.store(no, n)` encodes and writes it. A node that does not fit in a page makes `encode` panic: **split before you store**.
<!-- /lang -->

Keys are at most 128 bytes and values at most 1024. The limits are tiny next to a 4 KiB page on purpose: a page that overflows by one entry can always be cut into two halves that both fit.

## Searching
<!-- mode: read-and-implement tasks:2.1,2.2 -->

### One binary search per page, one page per level

Inside a page the keys are sorted, so finding the right child (or the key itself) is a binary search. Between pages, a lookup follows pointers from the root to a leaf:

```plaintext
  Get("p")
    root:  keys [m, t]        "p" >= m, "p" < t   ──▶ child 1
    leaf:  keys [m, p, r]     "p" found at index 1 ──▶ return vals[1]
```

The same walk finds where a **new** key belongs: it ends at the leaf whose range covers the key, and the key's place in that leaf's sorted order is the insertion point.

> [!warn] `>` for the child, `>=` for the leaf
> In an internal page you want the first separator **greater than** the key: a key equal
> to a separator belongs to the child on its right. In a leaf you want the first key
> **greater than or equal to** the target, and then check for equality. Mixing them up
> loses exactly the keys that sit on a separator.

<!-- lang: go -->
### `TODO(2.1)` — `childIndex` and `leafIndex`

In `internal/btree/search.go`:

- `childIndex(key)` on an internal node: the number of separators `<= key`, which is also the index of the child to follow. `sort.Search(len(n.keys), ...)` with `bytes.Compare(n.keys[i], key) > 0`.
- `leafIndex(key)` on a leaf: `sort.Search` for the first key `>= key`. Return that index and whether `n.keys[i]` equals `key` (check that `i` is in range first).

You will need to import `bytes` and `sort`.

### `TODO(2.2)` — `findLeaf` and `Get`

In the same file:

- `findLeaf(key)`: start at `t.io.Root()`. Root 0 means an empty tree: return `0, nil, nil`. Otherwise `t.load(no)`; if it is a leaf, return it; if not, move to `n.children[n.childIndex(key)]`. Loop at most `maxDepth` times and return `ErrCorrupt` beyond that, so a corrupt pointer cycle cannot hang the engine.
- `Get(key)`: `findLeaf`, then `leafIndex`. An empty tree or an absent key returns `nil, false, nil`.

`TestGetReadsOnePagePerLevel` counts page reads: a lookup that reads more than one page per level fails.
<!-- /lang -->

## Inserting into a leaf
<!-- mode: read-and-implement tasks:2.3 -->

### Keep the leaf sorted

Inserting is search plus a slice insert. The leaf is sorted, so `leafIndex` says where the key goes. If the key is already there, you overwrite its value instead of adding a second entry.

```plaintext
  leaf [a  c  m  x]      Put("f")        leaf [a  c  f  m  x]
  leaf [a  c  m  x]      Put("c", new)   leaf [a  c' m  x]       (same key, new value)
```

<!-- lang: go -->
### `TODO(2.3)` — `leafPut`

In `internal/btree/insert.go`. `i, found := n.leafIndex(key)`. If `found`, set `n.vals[i] = val`. Otherwise insert `key` into `n.keys` and `val` into `n.vals` at `i` with `slices.Insert`, so both slices stay sorted and in step.

You will need to import `slices`.
<!-- /lang -->

This may leave the node **overfull**: more bytes than a page holds. `leafPut` does not check. The caller does, and splits.

## Splitting
<!-- mode: read-and-implement tasks:2.4 -->

### A full page becomes two

When a page overflows, cut it in two at a point where both halves are about the same size in **bytes** (not entries, because values vary in length), and tell the parent about the new page. The tree grows sideways first, and only grows taller when the root itself splits.

```plaintext
  before:   parent [ ... ]
                      │
                  leaf [a b c d e f g h]   ← overfull

  after:    parent [ ... "e" ... ]
                      │       │
                  leaf [a b c d] ─▶ leaf [e f g h]
```

The two kinds of page split differently, and the difference is the heart of a B+ tree:

| | Leaf split | Internal split |
| --- | --- | --- |
| Left keeps | `keys[:at]` | `keys[:at]`, `children[:at+1]` |
| Right gets | `keys[at:]` | `keys[at+1:]`, `children[at+1:]` |
| Separator | **copy** of the right page's first key | the key at `at`, which **moves up** and stays in neither half |
| Why | the key still has to live in a leaf | the key is only a sign, and one copy is enough |

A leaf also keeps the sibling chain intact: the new right leaf inherits the old `next`, and the left leaf will point at the new right page (that part needs a page number, so the caller does it).

<!-- lang: go -->
### `TODO(2.4)` — `split`

In `internal/btree/insert.go`. `n.splitPoint()` (given) returns where to cut: for a leaf, the index of the first key of the right half; for an internal page, the index of the key that moves up.

- Leaf: `right` gets `slices.Clone(n.keys[at:])`, `slices.Clone(n.vals[at:])` and `next: n.next`. `n` keeps `keys[:at]` and `vals[:at]`. The separator is `right.keys[0]`.
- Internal: the separator is `n.keys[at]`. `right` gets clones of `n.keys[at+1:]` and `n.children[at+1:]`. `n` keeps `keys[:at]` and `children[:at+1]`: one more child than keys.

Clone the right half. If both nodes shared one backing array, an append to the left would overwrite the right.
<!-- /lang -->

## Growing the tree
<!-- mode: read-and-implement tasks:2.5 -->

### Splits travel upward

`Insert` descends recursively. On the way back up, each level learns whether the child it called split. If it did, the parent adds the separator and the new page after that child. If **that** overflows, the parent splits too, and the news keeps travelling.

```plaintext
  insert(root)
     insert(child 2)
        insert(leaf)         leaf overfull ──▶ split ──▶ returns (sep, rightPage)
     child 2 adds (sep, rightPage)   fits? yes ──▶ store, return nil
  root unchanged
```

If the news reaches the **root** and the root splits, there is no parent to tell. The tree makes one: a new root with a single separator and two children, the old root and its new sibling. The root pointer moves to the new page. This is the only way a B+ tree gets taller, and it does so everywhere at once, so every leaf stays at the same depth.

> [!idea] Why a B-tree is always balanced
> Insert never adds a level at the bottom. Leaves only split sideways; only the root
> splitting adds a level on top. Every path from root to leaf therefore has the same
> length, with no rebalancing pass at all.

<!-- lang: go -->
### `TODO(2.5)` — `Insert` and `insert`

In `internal/btree/insert.go`.

`insert(no, key, val)` returns a `*promoted` (the separator and the new right page) when page `no` split, and `nil` when it did not:

1. `n, err := t.load(no)`.
2. Leaf: `n.leafPut(key, val)`. Internal: `i := n.childIndex(key)`, then `up, err := t.insert(n.children[i], key, val)`. If `up == nil` the child absorbed the key and this page did not change: return `nil`. Otherwise `n.insertChild(i, up.sep, up.right)` (given).
3. If `n.fits()`: `t.store(no, n)` and return `nil`.
4. Otherwise `right, sep := n.split()`, `rightNo, err := t.io.Allocate()`. For a leaf, set `n.next = rightNo`. Store `right` at `rightNo` and `n` at `no`, and return `&promoted{sep: sep, right: rightNo}`.

`Insert(key, val)`:

1. `checkEntry(key, val)` (given) rejects empty and oversized entries.
2. Root 0 (empty tree): build a one-entry leaf, `t.newPage(leaf)`, `t.io.SetRoot(no)`.
3. Otherwise `up, err := t.insert(root, key, val)`. If `up != nil`, the root split: build an internal node `{keys: [up.sep], children: [root, up.right]}`, `newPage` it, and `SetRoot` to it.
<!-- /lang -->

> [!warn] No log yet
> A split writes two pages and then rewrites the parent: three writes, and nothing makes
> them atomic. Crash after the left page is rewritten but before the parent learns about
> the right one, and the upper half of that leaf is simply gone: nothing points at the
> page that holds it. Chapter 3 is the answer.

## Prove it
<!-- mode: read-only -->

<!-- lang: go -->
```bash
make test     # every acceptance test
make race     # the same tests with the race detector
make run      # a REPL that keeps its data in ./data
```
<!-- /lang -->

Try the REPL, and watch the height change:

```plaintext
$ make run
btreekv: dir=data, 0 keys, height 0. Type 'help'.
> put order:1 pending
OK
> get order:1
"pending"
> stats
keys=1 height=1 leaves=1 internal=0  pages=2 free=0  ...
```

Load a few thousand keys from a shell loop and run `stats` again: `height=3`, a few dozen leaves, and every `get` still costs three page reads. `stats` also runs `Check`, which verifies sort order, separator bounds, leaf depth, and the leaf chain. If your split is wrong, `stats` says which page.

> [!check] Before you move on
> Say these out loud:
>
> 1. Every key lives in one leaf; internal pages hold only separators.
> 2. A lookup reads one page per level, and the height is `log` base fan-out.
> 3. A leaf split copies the separator up; an internal split moves it up.
> 4. The tree only gets taller when the root splits, so it is always balanced.

### What is missing

If the process dies halfway through a split, the file can hold a page nothing points to, or a parent that points to a page that was never written. Even a clean-looking crash can leave a header out of date. Chapter 3 adds a **write-ahead log**: every change is logged first, and on startup the log is replayed to bring every page back.
