# btreekv

A B+ tree storage engine in Python, built chapter by chapter. This is chapter 2:
the B+ tree over the pager.

```
btreekv/pager/                chapter 1 (your code, carried forward)
btreekv/btree/search.py       binary search, findLeaf, Get   <- TODO 2.1, 2.2
btreekv/btree/insert.py       leafPut, split, Insert         <- TODO 2.3, 2.4, 2.5
btreekv/btree/node.py         node codec (given)
btreekv/db/db.py              Put / Get API (given)
tests/                        acceptance tests (given)
```

## Your work

| Task | Where | What |
| --- | --- | --- |
| 2.1 | `search.py` `child_index` / `leaf_index` | Binary search; a key equal to a separator goes right |
| 2.2 | `search.py` `find_leaf` / `get` | Walk root to leaf |
| 2.3 | `insert.py` `leaf_put` | Keep keys sorted; overwrite an existing key |
| 2.4 | `insert.py` `split` | Leaf copies separator up; internal moves it up |
| 2.5 | `insert.py` `insert` / `Insert` | Push splits up, grow a root |

## Running

```
make test
make run
```
