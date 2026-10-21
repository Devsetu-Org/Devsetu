# btreekv

A B+ tree storage engine in Go, built chapter by chapter. Pager, tree, log and
buffer pool are here. This is the last build chapter: delete with borrow and
merge, and range scans along the leaf links. The public API is complete.

```
cmd/btreekv/main.go             REPL over a data directory (given)
internal/pager/                 chapter 1, your code
internal/btree/                 chapters 2, your code
internal/wal/                   chapter 3, your code
internal/buffer/                chapter 4, your code
internal/btree/balance.go       merge / redistribute helpers (given)
internal/btree/cursor.go        SeekLeaf, ReadLeaf (given)
internal/btree/delete.go        delete, rebalance, Delete       <- TODO 5.1, 5.2, 5.3
internal/btree/delete_test.go   acceptance tests (given)
internal/db/scan.go             Scan along the leaf chain       <- TODO 5.4
internal/db/db.go               Put, Get, Delete around the engine (given)
internal/db/*_test.go           acceptance tests (given)
```

## Your work

| Task | Where | What |
| --- | --- | --- |
| 5.1 | `delete.go` `delete` | Descend, remove from the leaf, report "underfull" upward |
| 5.2 | `delete.go` `rebalance` | Merge with a sibling when the two fit in one page, otherwise borrow |
| 5.3 | `delete.go` `Delete` | Shrink the root: an empty leaf root empties the tree, a one-child root is replaced by its child |
| 5.4 | `scan.go` `Scan` | One descent to the start, then follow `Next` links |

Every file you write is carried into the next chapters unchanged.

## Running

```
make test     # go test ./...
make race     # same, with the race detector
make run      # REPL in ./data: put k v | get k | del k | scan [start [end]] | stats | quit
```

After deleting most of the keys, `stats` shows the tree shrinking: fewer
leaves, a lower height, and freed pages reported as `free`.
