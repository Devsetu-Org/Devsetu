# btreekv

A B+ tree storage engine in Go, built chapter by chapter. Your pager, tree and
log are here. This chapter adds the buffer pool: a fixed set of in-memory
frames between the tree and the page file.

```
cmd/btreekv/main.go             REPL over a data directory (given)
internal/pager/                 chapter 1, your code
internal/btree/                 chapter 2, your code
internal/wal/                   chapter 3, your code
internal/db/recover.go          chapter 3, your code
internal/buffer/pool.go         frames, the PageIO the engine sees (given)
internal/buffer/pin.go          pin and unpin a page            <- TODO 4.1
internal/buffer/evict.go        clock replacement               <- TODO 4.2
internal/buffer/flush.go        write back, log first           <- TODO 4.3
internal/buffer/buffer_test.go  acceptance tests (given)
internal/db/db.go               public API; tree I/O goes through the pool (given)
internal/db/*_test.go           acceptance tests (given)
```

## Your work

| Task | Where | What |
| --- | --- | --- |
| 4.1 | `pin.go` `pin`, `Unpin` | Return a cached frame or load the page into a victim; count pins; remember when a frame was dirtied |
| 4.2 | `evict.go` `victim` | Clock sweep: skip pinned frames, give referenced frames a second chance |
| 4.3 | `flush.go` `flushFrame` | Make the log durable up to the frame's LSN, then write the page |

Every file you write is carried into the next chapters unchanged.

## Running

```
make test     # go test ./...
make race     # same, with the race detector
make run      # REPL in ./data: put k v | get k | stats | quit
```

`stats` now shows how many pages the pool holds and how many of them are dirty.
Delete and scan arrive in chapter 5.
