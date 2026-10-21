# lsmkv

A log-structured merge tree in Go, built chapter by chapter. Your memtable,
write-ahead log, and SSTables (chapters 1 to 3) are here. This chapter makes
reads fast and complete: Bloom filters skip tables that cannot hold a key, and
a merging iterator stitches the memtable and every table into one range scan.

```
cmd/lsmkv/main.go                  REPL, now with scan (given)
internal/memtable/  internal/wal/  chapters 1 and 2, your code
internal/sstable/build.go lookup.go  internal/db/flush.go   chapter 3, your code
internal/sstable/writer.go reader.go  now write and check a filter block (given)
internal/bloom/bloom.go            build and query a filter     <- TODO 4.1, 4.2
internal/iterator/merging.go       k-way merge, newest wins     <- TODO 4.3
internal/db/scan.go                Scan                         <- TODO 4.4
internal/*/*_test.go               acceptance tests (given)
```

## Your work

| Task | Where | What |
| --- | --- | --- |
| 4.1 | `bloom.go` `Finish` | Size the bit array and set k bits per key |
| 4.2 | `bloom.go` `MayContain` | Check the same k bits; any clear bit means "definitely not" |
| 4.3 | `merging.go` `Less`, `Next` | Heap order (key, then newest), skip older copies of a key |
| 4.4 | `scan.go` `Scan` | Merge newest first, hide tombstones, honor the range |

Do 4.1 first: every new table gets a filter, so flushing (and most tests)
needs `Finish`.

## Running

```
make test     # go test ./...
make race     # same, with the race detector
make run      # REPL in ./data: put | get | del | scan [from] [to] | flush | stats
```
