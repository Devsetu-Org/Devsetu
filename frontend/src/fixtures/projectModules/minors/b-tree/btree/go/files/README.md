# btreekv

A B+ tree storage engine in Go, built chapter by chapter. Your chapter 1 pager
is here. This chapter builds the tree on top of it: search, insert, and the
split that keeps the tree balanced.

```
cmd/btreekv/main.go             REPL over a data directory (given)
internal/pager/                 chapter 1, your code
internal/btree/store.go         PageIO: what the tree needs from below (given)
internal/btree/node.go          node layout, encode/decode, splitPoint (given)
internal/btree/tree.go          Tree, load/store helpers (given)
internal/btree/search.go        binary search, Get              <- TODO 2.1, 2.2
internal/btree/insert.go        leaf insert, split, Insert      <- TODO 2.3, 2.4, 2.5
internal/btree/check.go         structural invariant checker (given)
internal/btree/btree_test.go    acceptance tests (given)
internal/db/db.go               public API around the tree (given)
internal/db/db_test.go          acceptance tests (given)
```

## Your work

| Task | Where | What |
| --- | --- | --- |
| 2.1 | `search.go` `childIndex`, `leafIndex` | Binary search inside one page |
| 2.2 | `search.go` `findLeaf`, `Get` | Walk from the root to the leaf, one page per level |
| 2.3 | `insert.go` `leafPut` | Insert or overwrite in a sorted leaf |
| 2.4 | `insert.go` `split` | Cut an overfull page in two; a leaf copies its separator up, an internal page moves it up |
| 2.5 | `insert.go` `Insert`, `insert` | Recurse down, push splits up, grow a new root |

Every file you write is carried into the next chapters unchanged.

## Running

```
make test     # go test ./...
make race     # same, with the race detector
make run      # REPL in ./data: put k v | get k | stats | quit
```

`stats` runs the invariant checker over the whole tree, so a broken split shows
up there as an error instead of as a lost key later. Delete and scan arrive in
chapter 5, and there is no log yet: do not kill the REPL mid-write.
