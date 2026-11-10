# lsmkv (Python)

A log-structured merge tree in Python, built chapter by chapter. Your chapter 1
memtable is here. This chapter makes it durable: every write is appended to a
write-ahead log before it is applied, and the log is replayed on startup.

Needs Python 3.9 or newer. No third-party packages: tests use `unittest`.

```
lsmkv/__main__.py               REPL over a data directory (given)
lsmkv/memtable/                 chapter 1, your code
lsmkv/wal/record.py             record framing + checksum       <- TODO 2.1
lsmkv/wal/writer.py             append (and fsync)              <- TODO 2.2
lsmkv/wal/reader.py             replay, stop at a torn tail     <- TODO 2.3
lsmkv/db/recover.py             recover on open; log first      <- TODO 2.4
lsmkv/db/db.py                  public API around them (given)
tests/test_wal.py               acceptance tests (given)
tests/test_db.py                acceptance tests (given)
```

## Your work

| Task | Where | What |
| --- | --- | --- |
| 2.1 | `record.py` `encode` | Header (CRC-32C, length) + payload |
| 2.2 | `writer.py` `append` | One write per record; fsync under `SyncMode.ALWAYS` |
| 2.3 | `reader.py` `replay` | Yield intact records; stop at the first bad one and report where |
| 2.4 | `recover.py` `recover_log`, `commit` | Replay into the memtable, cut the torn tail, log before applying |

Every file you write is carried into the next chapters unchanged.

## Running

```
make test     # python3 -m unittest
make run      # REPL in ./data: put k v | get k | del k | stats | quit
```

Kill the REPL with Ctrl-C after a few puts and start it again: everything is
still there.
