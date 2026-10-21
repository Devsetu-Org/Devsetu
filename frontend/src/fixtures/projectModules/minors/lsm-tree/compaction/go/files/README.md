# lsmkv

A log-structured merge tree in Go, built chapter by chapter. Your code from
chapters 1 to 4 is here: memtable, write-ahead log, SSTables, Bloom filters,
and merged range scans. This last chapter keeps the store from growing
without bound: compaction merges tables, keeps the newest version of each
key, and drops tombstones that have nothing left to hide. A manifest records
which tables are live, so every swap is atomic.

```
cmd/lsmkv/main.go                  REPL, now with compact (given)
internal/memtable/ wal/ sstable/   chapters 1 to 3, your code
internal/bloom/ iterator/          chapter 4, your code
internal/db/recover.go flush.go scan.go   chapters 2 to 4, your code
internal/compaction/compaction.go  merge inputs, drop tombstones  <- TODO 5.1
internal/manifest/manifest.go      atomic save                    <- TODO 5.2
internal/db/compact.go             compactRange                   <- TODO 5.3
internal/db/db.go                  public API, manifest on open (given)
internal/*/*_test.go               acceptance tests (given)
```

## Your work

| Task | Where | What |
| --- | --- | --- |
| 5.1 | `compaction.go` `Merge` | Newest version of each key; drop tombstones only when told |
| 5.2 | `manifest.go` `Save` | Write a temp file, fsync, rename over MANIFEST, fsync the dir |
| 5.3 | `compact.go` `compactRange` | Write the output, commit it in the manifest, then delete the inputs |

Do 5.2 first: flushes now record every new table in the manifest.

## Running

```
make test     # go test ./...
make race     # same, with the race detector
make run      # REPL in ./data: put | get | del | scan | flush | compact | stats
```
