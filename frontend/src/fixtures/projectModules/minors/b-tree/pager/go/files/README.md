# btreekv

A B+ tree storage engine in Go, built chapter by chapter. This is chapter 1:
the pager, the layer that turns a file into an array of checksummed pages.

```
cmd/btreekv/main.go           REPL over the pager (given)
internal/pager/page.go        page size, header layout, free page layout (given)
internal/pager/pager.go       Open, Sync, Close, header state (given)
internal/pager/readwrite.go   checksummed page I/O          <- TODO 1.1, 1.2
internal/pager/alloc.go       Allocate and Free             <- TODO 1.3, 1.4
internal/pager/pager_test.go  acceptance tests (given)
```

## Your work

| Task | Where | What |
| --- | --- | --- |
| 1.1 | `readwrite.go` `WritePage` | Seal the page with a CRC-32C trailer and write it at `no * PageSize` |
| 1.2 | `readwrite.go` `ReadPage` | Read a page and verify its trailer |
| 1.3 | `alloc.go` `Allocate` | Pop the freelist, or grow the file by one page |
| 1.4 | `alloc.go` `Free` | Push a page onto the freelist |

Every file you write is carried into the next chapters unchanged.

## Running

```
make test     # go test ./...
make race     # same, with the race detector
make run      # REPL on ./data.db: alloc | write n text | read n | free n | meta | quit
```
