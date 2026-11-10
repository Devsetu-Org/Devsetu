# lsmkv (C++)

A log-structured merge tree in C++17, built chapter by chapter. Your chapter 1
memtable is here. This chapter makes it durable: every write is appended to a
write-ahead log before it is applied, and the log is replayed on startup.

Needs a C++17 compiler. No third-party packages: tests use `tests/check.h`.

```
cmd/lsmkv/main.cc               REPL over a data directory (given)
src/memtable/                   chapter 1, your code
src/wal/record.cc               record framing + checksum       <- TODO 2.1
src/wal/writer.cc               append (and fsync)              <- TODO 2.2
src/wal/reader.cc               replay, stop at a torn tail     <- TODO 2.3
src/db/recover.cc               recover on Open; log first      <- TODO 2.4
src/db/db.cc                    public API around them (given)
tests/wal_test.cc               acceptance tests (given)
tests/db_test.cc                acceptance tests (given)
```

## Your work

| Task | Where | What |
| --- | --- | --- |
| 2.1 | `record.cc` `Encode` | Header (CRC-32C, length) + payload |
| 2.2 | `writer.cc` `Append` | One write per record; fsync under `SyncMode::kAlways` |
| 2.3 | `reader.cc` `Replay` | Yield intact records; stop at the first bad one and report where |
| 2.4 | `recover.cc` `RecoverLog`, `Commit` | Replay into the memtable, cut the torn tail, log before applying |

Every file you write is carried into the next chapters unchanged.

## Running

```
make test     # all acceptance tests
make asan     # same under AddressSanitizer + UBSan
make run      # REPL in ./data: put k v | get k | del k | stats | quit
```

Kill the REPL with Ctrl-C after a few puts and start it again: everything is
still there.
