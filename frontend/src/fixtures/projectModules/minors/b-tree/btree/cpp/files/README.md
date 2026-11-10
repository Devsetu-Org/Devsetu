# btreekv

A B+ tree storage engine in C++, built chapter by chapter. This is chapter 2:
the B+ tree over the pager.

```
src/pager/                 chapter 1 (your code, carried forward)
src/btree/search.cc        ChildIndex, LeafIndex, FindLeaf, Get   <- TODO 2.1, 2.2
src/btree/insert.cc        LeafPut, Split, Insert                 <- TODO 2.3, 2.4, 2.5
src/btree/node.h/.cc       node codec (given)
src/db/db.h/.cc            Put / Get API (given)
tests/                     acceptance tests (given)
```

## Running

```
make test
make asan
make run
```
