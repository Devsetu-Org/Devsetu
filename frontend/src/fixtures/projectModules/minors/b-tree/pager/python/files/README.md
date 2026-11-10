# btreekv

A B+ tree storage engine in Python, built chapter by chapter. This is chapter 1:
the pager, the layer that turns a file into an array of checksummed pages.

```
btreekv/__main__.py           REPL over the pager (given)
btreekv/pager/page.py         page size, header layout, free page layout (given)
btreekv/pager/pager.py        Open, Sync, Close, header state (given)
btreekv/pager/readwrite.py    checksummed page I/O          <- TODO 1.1, 1.2
btreekv/pager/alloc.py        Allocate and Free             <- TODO 1.3, 1.4
tests/test_pager.py           acceptance tests (given)
```

## Your work

| Task | Where | What |
| --- | --- | --- |
| 1.1 | `readwrite.py` `write_page` | Seal the page with a CRC-32C trailer and write it at `no * PAGE_SIZE` |
| 1.2 | `readwrite.py` `read_page` | Read a page and verify its trailer |
| 1.3 | `alloc.py` `allocate` | Pop the freelist, or grow the file by one page |
| 1.4 | `alloc.py` `free` | Push a page onto the freelist |

Every file you write is carried into the next chapters unchanged.

## Running

```
make test     # python3 -m unittest
make run      # REPL on ./data.db: alloc | write n text | read n | free n | meta | quit
```
