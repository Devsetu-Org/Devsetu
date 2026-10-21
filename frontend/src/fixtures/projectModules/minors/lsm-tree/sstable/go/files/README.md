# lsmkv

A log-structured merge tree in Go, built chapter by chapter. Your memtable
(chapter 1) and write-ahead log (chapter 2) are here. This chapter writes a
full memtable to disk as a sorted, immutable SSTable, and starts the log over.

```
cmd/lsmkv/main.go                REPL over a data directory (given)
internal/memtable/               chapter 1, your code
internal/wal/  internal/db/recover.go   chapter 2, your code
internal/sstable/format.go       layout, block / index / footer encoding (given)
internal/sstable/build.go        data blocks, index, footer     <- TODO 3.1, 3.2
internal/sstable/lookup.go       open, one-block point lookup   <- TODO 3.3
internal/sstable/writer.go       public Writer around build.go (given)
internal/sstable/reader.go       public Table around lookup.go (given)
internal/sstable/iterator.go     ordered walk over a table (given)
internal/db/flush.go             flush when the memtable fills  <- TODO 3.4
internal/db/db.go                public API (given)
internal/sstable/sstable_test.go acceptance tests (given)
internal/db/*_test.go            acceptance tests (given)
```

## Your work

| Task | Where | What |
| --- | --- | --- |
| 3.1 | `build.go` `add`, `flushBlock` | Fill data blocks in key order; cut at BlockSize and index each block |
| 3.2 | `build.go` `finish` | Index block, footer, fsync |
| 3.3 | `lookup.go` `open`, `get` | Footer and index on open; a lookup reads exactly one data block |
| 3.4 | `flush.go` `flush` | Write the table, rename it into place, then reset the log and memtable |

Every file you write is carried into the next chapters unchanged.

## Running

```
make test     # go test ./...
make race     # same, with the race detector
make run      # REPL in ./data: put | get | del | flush | stats | quit
```
