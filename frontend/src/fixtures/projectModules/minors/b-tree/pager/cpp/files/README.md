# btreekv

A B+ tree storage engine in C++, built chapter by chapter. This is chapter 1:
the pager, the layer that turns a file into an array of checksummed pages.

```
cmd/btreekv/main.cc           REPL over the pager (given)
src/pager/page.h/.cc          page size, header layout, free page layout (given)
src/pager/pager.h/.cc         Open, Sync, Close, header state (given)
src/pager/readwrite.cc        checksummed page I/O          <- TODO 1.1, 1.2
src/pager/alloc.cc            Allocate and Free             <- TODO 1.3, 1.4
tests/pager_test.cc           acceptance tests (given)
```

## Your work

| Task | Where | What |
| --- | --- | --- |
| 1.1 | `readwrite.cc` `WritePage` | Seal the page with a CRC-32C trailer and write it at `no * kPageSize` |
| 1.2 | `readwrite.cc` `ReadPage` | Read a page and verify its trailer |
| 1.3 | `alloc.cc` `Allocate` | Pop the freelist, or grow the file by one page |
| 1.4 | `alloc.cc` `Free` | Push a page onto the freelist |

Every file you write is carried into the next chapters unchanged.

## Running

```
make test     # build and run every acceptance test
make asan     # the same tests under AddressSanitizer + UBSan
make run      # REPL on ./data.db: alloc | write n text | read n | free n | meta | quit
```
