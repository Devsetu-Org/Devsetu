# btreekv

A B+ tree storage engine in Go, built chapter by chapter. Your pager and tree
are here. This chapter makes writes survive a crash: every change is logged
before any page is touched, and the log is replayed on startup.

```
cmd/btreekv/main.go             REPL over a data directory (given)
internal/pager/                 chapter 1, your code
internal/btree/                 chapter 2, your code
internal/wal/record.go          record framing + checksum           <- TODO 3.1
internal/wal/writer.go          append a batch, fsync               <- TODO 3.2
internal/wal/reader.go          replay, stop at a torn tail         <- TODO 3.3
internal/wal/meta.go            meta and commit records (given)
internal/wal/wal_test.go        acceptance tests (given)
internal/db/txn.go              a write in flight, as log records (given)
internal/db/apply.go            records -> pages (given)
internal/db/recover.go          recover on Open; log before pages   <- TODO 3.4
internal/db/db.go               public API around them (given)
internal/db/*_test.go           acceptance tests (given)
```

## Your work

| Task | Where | What |
| --- | --- | --- |
| 3.1 | `record.go` `encode` | Frame: CRC-32C and length in front of the payload |
| 3.2 | `writer.go` `Append` | One write per batch; fsync under `SyncAlways` |
| 3.3 | `reader.go` `Replay` | Yield intact records with their end offsets; stop at the first bad one |
| 3.4 | `recover.go` `recoverLog`, `commit` | Apply only committed batches, cut the log at the last commit, append before applying |

Every file you write is carried into the next chapters unchanged.

## Running

```
make test     # go test ./...
make race     # same, with the race detector
make run      # REPL in ./data: put k v | get k | stats | quit
```

Kill the REPL with Ctrl-C after a few puts and start it again: everything is
still there. Delete and scan arrive in chapter 5.
