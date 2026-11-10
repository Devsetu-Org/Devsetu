# lsmkv (Python)

A log-structured merge tree in Python, built chapter by chapter. Chapters 1–2
gave you a durable memtable. This chapter flushes it to immutable sorted files
(SSTables) and looks keys up across them.

Needs Python 3.9 or newer. No third-party packages.

```
lsmkv/sstable/build.py          fill/cut data blocks; index+footer   <- TODO 3.1, 3.2
lsmkv/sstable/lookup.py         open footer/index; one-block get     <- TODO 3.3
lsmkv/db/flush.py               flush memtable to a new table        <- TODO 3.4
```

## Running

```
make test
make run
```
