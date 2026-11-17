## The memtable
<!-- mode: read-only -->

In the previous chapter you got a glance at what an LSM storage engine is at an abstract level. Now we dig into it block by block. This chapter builds the block every write touches first.

![Write path: WAL (ch 2), Memtable (you are here), SSTables (ch 3); Get checks memtable first](/lsm-tree/memtable/you-are-here.jpg)

> [!scope] This chapter's job
> Only the memtable. No log, no files, no compaction. Chapter 2 makes writes durable. Chapter 3 flushes a full memtable to disk.

### What we are building

A **memtable** is the in-memory buffer that sits in front of the disk. Every `Put` and `Delete` lands here first. Every `Get` checks here first. When it fills up, chapter 3 will walk it in key order and write a sorted file (an SSTable). Until then, the memtable *is* the live store.

So by the end of this chapter you have a sorted map in RAM that can:

- insert and overwrite keys quickly
- answer point lookups
- walk keys in order (for flush and for range scans later)
- track roughly how big it is, so the engine can decide "full"

No disk. Kill the process and it is gone — that is chapter 2's problem.

### Why not a hash map or a plain list?

The hard part is not storing "key → value". It is doing that **while staying sorted**, because the next chapter must flush keys in order without sorting a million entries every time.

| Structure | Insert | Lookup | Ordered walk | Why it falls short here |
| --- | --- | --- | --- | --- |
| Hash map | O(1) | O(1) | No | Unordered — you would re-sort on every flush and every scan |
| Sorted slice / array | O(n) | O(log n) | Yes | Every insert shifts half the array |
| Balanced tree (red-black, AVL) | O(log n) | O(log n) | Yes | Works, but rotations are fiddly and hard to share safely with concurrent readers |
| **Skiplist** | O(log n) expected | O(log n) expected | Yes | Simple links, no rotations, and readers never see a half-rebalanced tree |

LevelDB and RocksDB both use a skiplist for their memtable. So will you.

### What a skiplist is

A skiplist is a **sorted linked list with express lanes** (Bill Pugh, ~1990). It fixes the usual linked-list problem: inserts are cheap, but search is O(n) because you cannot jump to the middle.

The bottom level (level 0) holds every key, sorted, like a normal linked list. Upper levels hold only some of those keys — shortcuts that skip ahead. To search, start on a high level. Move forward while you can without going past the key. Then drop one level and continue. Repeat. There is no rebalancing.

A **perfect** skiplist would put exactly half the nodes on each higher level, like a perfect binary tree. That shape is too rigid to update cheaply. Real skiplists (and yours) **relax** the rule with randomness: each new node is promoted upward with fixed probability, so you *expect* about the same density of shortcuts as the perfect picture, without rearranging the whole list.

That is the whole idea. The next page makes precise what a node is, how search walks the towers, and what the coin flips actually decide.

> [!tip] What "expected" means
> O(log n) here is over the random height choices, not a worst-case guarantee. Degenerate shapes (every node height 1, or every node max height) are possible but vanishingly unlikely. The height of each node is chosen independently of its key, so there is no "bad" insertion order that forces a linear list the way a sorted insert can wreck an unbalanced BST. With 100,000 keys your tests will see roughly 30 comparisons per lookup, not 50,000.

## Build the skiplist
<!-- mode: read-and-implement tasks:1.1,1.2 -->

### What a node is

A skiplist **node** is just one key in the list — for example the key `20` in the picture below. It stores that key, its value (or a tombstone), and some forward pointers so you can walk to the next key.

The twist is the **tower**. Every node lives on level 0 (the ordinary sorted list). Some nodes also get shortcut pointers on higher levels — like express lanes. In the picture, `20` and `50` appear stacked on levels 2, 1, and 0: that stack is **one node**, not three. Key `40` only has a short tower (level 0). Key `35` reaches level 1.

So for each node you really only need to remember:

- the payload: `key`, `value`, and `kind`
- `next[0]` — always present; points at the next key on the bottom list
- `next[1]`, `next[2]`, … — only if this node was promoted onto those express lanes
- tower height = how many of those `next` slots it has (chosen once at insert; it never changes)

A short tower is one pointer; a tall tower is many. Each `next[i]` points at the **start** of another node (its whole tower), not at a single box inside it. Diagrams draw the links sideways for clarity; in memory they are just an array of pointers on that node.

Two sentinels bookend the structure. Your list's **`head`** is a full-height sentinel with no key — search always starts there. Higher levels skip over many level-0 nodes; that is the name.

![Skiplist levels 2–0: head → keys 10…50 → nil; same key stacks as one tower](/lsm-tree/memtable/skiplist.jpg)

Level 0 holds every node, in order. Higher levels are shortcuts over the same nodes.

### Search: walk right, drop down

To find a key `k`, start at `head` on the tallest level. On each level:

- if the **next** node's key is still `< k`, move right (you have not passed the target yet)
- if the next key is `>= k` (or there is no next), **drop down** one level and keep going from the **same** node

You are doing sorted sequential search on each lane, then switching to a denser lane when you would overshoot — the same idea as scanning an array until `X[i] >= K`, but with express lanes so you do not start every scan from the beginning.

The node where you stop on each level is the **last node whose key is `< k`** on that level. Record it in a `prev` array: those are exactly the links a new node would splice into. One walk gives both the lookup answer and the insertion points.

Return the first node on level 0 whose key is `>=` the target (or nil / `None` / `nullptr` if there is none).

> [!warn] Do not restart from the head
> When you drop a level, keep going from the node you are on. Restarting from `head` on each level turns the search back into a linear scan, and the "search is logarithmic" test will catch it.

<!-- lang: go -->
### `TODO(1.1)` — `findGreaterOrEqual`

In `internal/memtable/skiplist.go`. Start at `s.head` on level `s.height - 1`. On each level, move right while the next node's key is smaller than the target (use `s.compare`, which the tests count). Record `prev[level]` if `prev` is non-nil, then drop down. Return `x.next[0]`: the first node whose key is `>=` the target, or `nil`.
<!-- /lang -->
<!-- lang: python -->
### `TODO(1.1)` — `find_greater_or_equal`

In `lsmkv/memtable/skiplist.py`. Start at `self.head` on level `self.height - 1`. On each level, move right while the next node's key is smaller than the target (use `self._less`, which the tests count). Record `prev[level]` if `prev` was passed, then drop down. Return `x.next[0]`: the first node whose key is `>=` the target, or `None`.
<!-- /lang -->
<!-- lang: cpp -->
### `TODO(1.1)` — `FindGreaterOrEqual`

In `src/memtable/skiplist.cc`. Start at `head_` on level `height_ - 1`. On each level, move right while the next node's key is smaller than the target (use `Compare`, which the tests count). Record `prev[level]` if `prev` is not `nullptr`, then drop down. Return `x->next[0]`: the first node whose key is `>=` the target, or `nullptr`.
<!-- /lang -->

### Insert: what randomization actually means

A **perfect** skiplist would keep exactly half the nodes on each higher level. Inserting or deleting would often force a global reshuffle — like maintaining a perfect binary search tree. Skiplists avoid that by **randomizing tower height** instead of rebalancing.

When you insert a **new** key:

1. Search as above and get the `prev` array (where the node will splice in on each level).
2. Always place the node on **level 0** (every key lives in the bottom list).
3. Flip a biased coin to decide how much taller the tower grows. The given `randomHeight` helper does this: height 1 with probability 3/4; with probability 1/4 promote to level 1; of those, 1/4 again to level 2; and so on (branching factor 4, same idea as the classic "promote with probability 1/2" skiplist). So on average about **1/4** of nodes appear on level 1, **1/16** on level 2, …
4. For each level `i` the tower reaches, splice after `prev[i]`: `n.next[i] = prev[i].next[i]`, then `prev[i].next[i] = n`. If the new tower is taller than the list's current height, raise the list height and treat `head` as the predecessor on the new levels.

That is all "randomization" means here: **each node's height is chosen by coin flips at insert time, independently of its key.** The same sequence of puts can produce different tower shapes on different runs. You do not rearrange neighbors. You do not rotate. Expected lane density stays like the perfect picture, so expected search stays O(log n).

> [!tip] Why this is safe to rely on
> A run of bad luck could in theory leave you with a plain linked list or with every node at max height — both are exponentially unlikely. Because height does not depend on key order, sorted inserts are no worse than random inserts. Your tests seed the RNG so results are reproducible; production uses a real seed and still sees logarithmic lookups.

> [!idea] Overwrite in place
> If the key is already there, do not insert a second node and do not re-roll height. Replace the value and kind on the existing node. A memtable holds **one entry per key**: the newest write. Older versions of the key may exist on disk, and chapter 4 makes sure the memtable wins.

<!-- lang: go -->
### `TODO(1.2)` — `put`

1. Search with a `prev` array.
2. Same key found: overwrite value and kind, adjust `s.size` by the change in value length, return. `s.length` does not change.
3. New key: pick a height, raise `s.height` (with `head` as predecessor) if needed, splice the tower into every level it reaches: `n.next[i] = prev[i].next[i]`, then `prev[i].next[i] = n`.
4. `s.length++`, `s.size += entrySize(key, value)`.
<!-- /lang -->
<!-- lang: python -->
### `TODO(1.2)` — `put`

1. Search with `prev = [None] * MAX_HEIGHT`.
2. Same key found: overwrite value and kind, adjust `self.size` by the change in value length (a tombstone's value is `None`, length 0), return. `self.length` does not change.
3. New key: pick a height, raise `self.height` (with `self.head` as predecessor) if needed, splice the tower into every level it reaches: `n.next[i] = prev[i].next[i]`, then `prev[i].next[i] = n`.
4. `self.length += 1`, `self.size += entry_size(key, value)`.
<!-- /lang -->
<!-- lang: cpp -->
### `TODO(1.2)` — `Put`

1. Search with `Node* prev[kMaxHeight]`.
2. Same key found: overwrite value and kind, adjust `size_` by the change in value length, return. `size_` is unsigned, so subtract the old length and add the new one. `length_` does not change.
3. New key: pick a height, raise `height_` (with `head_` as predecessor) if needed, create the node with `NewNode`, and splice it into every level it reaches: `n->next[i] = prev[i]->next[i]`, then `prev[i]->next[i] = n`.
4. `++length_`, `size_ += EntrySize(key, value)`. Compute the size **before** moving `key` and `value` into the node.

> [!tip] Who owns the nodes
> The list owns every node through `arena_` (`NewNode` puts it there), and the `next` links are plain pointers into it. Nodes are freed all at once when the list is destroyed. LevelDB's memtable uses the same arena idea.
<!-- /lang -->

## Tombstones and ordered walks
<!-- mode: read-and-implement tasks:1.3,1.4 -->

### A delete is a write

Picture a key that was written long ago and already flushed to an SSTable. Now the user deletes it. If the memtable simply forgets the key, the next `Get` misses the memtable, finds the old value on disk, and returns it. The deleted key comes back.

![Wrong: removing the key resurrects the SSTable value. Right: a tombstone stops the lookup](/lsm-tree/memtable/tombstone.jpg)

The fix is to **record** the delete. A **tombstone** sits in the memtable like any other write, gets flushed like any other write, and shadows older values the same way a newer `Put` would. It only disappears during compaction (chapter 5), once no older value is left for it to hide.

> [!takeaway] In an LSM tree, a delete is a write
> `Delete` stores a tombstone. It even stores one for a key the memtable has never seen, because that key may still live in an older file.

### Three answers, not two

To a user, a lookup has two answers: there is a value, or there is not. Inside the LSM tree each table has **three**:

| Result | Meaning | What the read path does next (chapter 4) |
| --- | --- | --- |
| `Found` | This table has a live value | Return it, stop |
| `Deleted` | This table has a tombstone | Return "not found", **stop** |
| `Missing` | This table knows nothing about the key | Keep looking in older tables |

`Deleted` and `Missing` look the same to the user and mean opposite things to the engine. Getting that difference right is what keeps deleted data deleted.

<!-- lang: go -->
### `TODO(1.3)` — `Delete` and `Get`

In `internal/memtable/memtable.go`:

- `Delete`: copy the key the same way `Put` does, take the write lock, and `m.list.put(k, nil, KindTombstone)`.
- `Get`: take the read lock, `m.list.get(key)`, and map no node, tombstone, and live value to `Missing`, `Deleted`, and `Found`. Only `Found` returns a value.

> [!scope] Locking
> `Memtable` uses a read/write mutex: one writer at a time, many concurrent readers. The skiplist itself is not thread-safe, which keeps it simple. Production engines make the skiplist lock-free for readers; that is out of scope here.
<!-- /lang -->
<!-- lang: python -->
### `TODO(1.3)` — `delete` and `get`

In `lsmkv/memtable/memtable.py`:

- `delete`: copy the key with `bytes(key)` the same way `put` does, take the lock, and `self._list.put(k, None, Kind.TOMBSTONE)`.
- `get`: take the lock, `self._list.get(key)`, and map no node, tombstone, and live value to `(None, Result.MISSING)`, `(None, Result.DELETED)`, and `(node.value, Result.FOUND)`.

> [!scope] Locking
> Python's standard library has no read/write lock, so one `threading.Lock` guards both reads and writes. The skiplist itself is not thread-safe, which keeps it simple. Production engines make the skiplist lock-free for readers; that is out of scope here.
<!-- /lang -->
<!-- lang: cpp -->
### `TODO(1.3)` — `Delete` and `Get`

In `src/memtable/memtable.cc`:

- `Delete`: take the write lock (`std::unique_lock`, like `Put`) and `list_.Put(std::string(key), "", Kind::kTombstone)`.
- `Get`: take the read lock (`std::shared_lock`), `list_.Get(key)`, and map no node, tombstone, and live value to `kMissing`, `kDeleted`, and `kFound`. Only `kFound` writes to `*value`.

> [!scope] Locking
> `Memtable` uses a `std::shared_mutex`: one writer at a time, many concurrent readers. The skiplist itself is not thread-safe, which keeps it simple. Production engines make the skiplist lock-free for readers; that is out of scope here.
<!-- /lang -->

### Walking in order

Chapter 3 flushes a full memtable by walking it from the smallest key to the largest and writing each entry, tombstones included, into a sorted file. Range scans need the same walk, starting from a given key.

Level 0 of the skiplist already **is** the sorted list. Upper levels are only for getting somewhere fast.

![Seek lands on the first key >= target on level 0; Next steps along until Valid is false](/lsm-tree/memtable/iterate.jpg)

<!-- lang: go -->
### `TODO(1.4)` — `Seek` and `Next`

In `internal/memtable/iterator.go`:

- `Seek(target)`: the search from task 1.1 already returns the first node with key `>=` target. Position the iterator there. No `prev` array is needed.
- `Next`: step to the next node on level 0.

`SeekToFirst`, `Valid`, `Key`, `Value`, and `Kind` are given.
<!-- /lang -->
<!-- lang: python -->
### `TODO(1.4)` — `seek` and `next`

In `lsmkv/memtable/iterator.py`:

- `seek(target)`: the search from task 1.1 already returns the first node with key `>=` target. Position the iterator there. No `prev` list is needed.
- `next()`: step to the next node on level 0.

`seek_to_first`, `valid`, `key`, `value`, and `kind` are given.
<!-- /lang -->
<!-- lang: cpp -->
### `TODO(1.4)` — `Seek` and `Next`

In `src/memtable/iterator.cc`:

- `Seek(target)`: the search from task 1.1 already returns the first node with key `>=` target. Position the iterator there. Pass `nullptr` for `prev`.
- `Next`: step to the next node on level 0.

`SeekToFirst`, `Valid`, `Key`, `Value`, and `kind` are given in `iterator.h`.
<!-- /lang -->

> [!warn] Iterators take no lock
> An iterator walks the list without holding the memtable's lock. That is safe for a memtable that has been **frozen** (chapter 3 freezes it before flushing), but not while another thread is still writing to it.

> [!check] Before you move on
> 1. An LSM tree turns random writes into sequential ones by buffering in memory and writing sorted files.
> 2. A skiplist **node** is one key plus a tower of `next` pointers; level 0 links every node, higher levels are shortcuts.
> 3. **Randomization** means each new node's tower height is chosen by coin flips (not by rebalancing); search walks right, drops down, and never restarts from the head.
> 4. A delete is a tombstone, because older files may still hold the key.
> 5. A lookup in one table answers `Found`, `Deleted`, or `Missing`, and only `Missing` means "keep looking".

The memtable lives only in RAM — kill the process and it is gone. Chapter 2 adds the **write-ahead log**: every write is appended to a file before it is acknowledged, and on startup the log is replayed to rebuild the memtable.
