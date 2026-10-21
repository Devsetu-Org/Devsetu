# lsmkv

A log-structured merge tree in Go, built chapter by chapter. Your chapter 1
memtable is here. This chapter makes it durable: every write is appended to a
write-ahead log before it is applied, and the log is replayed on startup.

```
cmd/lsmkv/main.go               REPL over a data directory (given)
internal/memtable/              chapter 1, your code
internal/wal/record.go          record framing + checksum       <- TODO 2.1
internal/wal/writer.go          append (and fsync)              <- TODO 2.2
internal/wal/reader.go          replay, stop at a torn tail     <- TODO 2.3
internal/db/recover.go          recover on Open; log first      <- TODO 2.4
internal/db/db.go               public API around them (given)
internal/wal/wal_test.go        acceptance tests (given)
internal/db/db_test.go          acceptance tests (given)
```

## Your work

| Task | Where | What |
| --- | --- | --- |
| 2.1 | `record.go` `encode` | Header (CRC-32C, length) + payload |
| 2.2 | `writer.go` `Append` | One write per record; fsync under `SyncAlways` |
| 2.3 | `reader.go` `Replay` | Yield intact records; stop at the first bad one and report where |
| 2.4 | `recover.go` `recoverLog`, `commit` | Replay into the memtable, cut the torn tail, log before applying |

Every file you write is carried into the next chapters unchanged.

## Running

```
make test     # go test ./...
make race     # same, with the race detector
make run      # REPL in ./data: put k v | get k | del k | stats | quit
```

Kill the REPL with Ctrl-C after a few puts and start it again: everything is
still there.
