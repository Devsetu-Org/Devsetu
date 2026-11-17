# btreekv — write-ahead log (C++)

Chapter 3: frame WAL records, append with fsync, replay to the torn tail, and
wire recover/commit so every Put logs before pages change.

```
make test   # acceptance tests
make asan   # AddressSanitizer (Linux recommended)
make run    # REPL in ./data
```

Student files: `src/wal/record.cc`, `src/wal/writer.cc`, `src/wal/reader.cc`,
`src/db/recover.cc`.
