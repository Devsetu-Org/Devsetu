# lsmkv (C++)

Chapter 3: SSTables. Needs C++17.

| Task | Where | What |
| --- | --- | --- |
| 3.1 | `build.cc` `add`, `flushBlock` | Fill and cut data blocks |
| 3.2 | `build.cc` `finish` | Index and footer |
| 3.3 | `lookup.cc` `OpenFile`, `get` | One-block lookups |
| 3.4 | `flush.cc` `flush` | Flush the memtable |

```
make test
make asan
make run
```
