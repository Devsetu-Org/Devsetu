## Where you are
<!-- mode: read-only -->

Chapter 1 built the memtable: a sorted map in RAM. It is fast, and a crash wipes it out. Every write the user was told "OK" about is gone.

```plaintext
            Put / Delete
                 │
        ┌────────▼────────┐
  ch 2  │  Write-ahead log │ ◀──── you are here
        └────────┬────────┘
        ┌────────▼────────┐
  ch 1  │    Memtable      │  done
        └─────────────────┘
```

This chapter adds the **write-ahead log** (WAL): an append-only file that receives every write before the memtable does. On startup the engine reads the log from the beginning and replays each write into a fresh memtable.

> [!scope] This chapter's job
> Make acknowledged writes survive a crash. No SSTables yet: the log grows forever
> in this chapter, and chapter 3 starts trimming it.

## Why a log
<!-- mode: read-only -->

### The rule

**Log first, then apply, then acknowledge.** If the process dies after the log append, replay brings the write back. If it dies before, the write was never acknowledged, so losing it breaks no promise.

```plaintext
  Put("order:7", "paid")
     │
     ├─ 1. append record to wal.log   ← durable from here (with fsync)
     ├─ 2. apply to memtable          ← visible to Get from here
     └─ 3. return OK                  ← the promise
```

Reverse steps 1 and 2 and there is a window where a reader sees a value that a crash would erase.

### Why appending is cheap

The log is written strictly at its end. Disks and SSDs are fastest at sequential writes, and the OS can merge small appends. No seeking, no rewriting old data. This is the same trick the whole LSM tree is built on: never update in place.

### Where else you have seen this

| System | Its write-ahead log |
| --- | --- |
| PostgreSQL | `pg_wal/` segments, also used for replication |
| MySQL InnoDB | the redo log |
| RocksDB / LevelDB | `*.log` files next to the SSTables |
| etcd | the Raft log, fsynced before a write is committed |
| Kafka | the whole product is a replicated append-only log |

## The record format
<!-- mode: read-and-implement tasks:2.1 -->

### A crash can stop a write halfway

A log write is not atomic. A crash or power cut can leave the last record half written: some bytes on disk, the rest missing. Replay must be able to tell "this is a whole record" from "this is the remains of one". So each record carries its own length and a **checksum**.

```plaintext
  ┌──────────────┬──────────────┬──────────────────────────────────────────┐
  │ crc32c  (4)  │ length  (4)  │ payload (length bytes)                    │
  └──────────────┴──────────────┴──────────────────────────────────────────┘
                                  kind (1) │ keyLen (uvarint) │ key │ valueLen (uvarint) │ value
```

- **length** says how many payload bytes follow. If the file ends before that, the record was cut short.
- **crc32c** is a checksum of the payload. If any byte of the payload is wrong, the checksum will not match.
- **uvarint** lengths use 1 byte for values under 128, so short keys cost almost nothing.

> [!tip] Why CRC-32C
> CRC-32C (Castagnoli) is the checksum RocksDB, LevelDB, ext4, and iSCSI use. Modern CPUs compute it in hardware. It is not cryptographic: it catches accidents, not attackers.

<!-- lang: go -->
### `TODO(2.1)` — `encode`

In `internal/wal/record.go`. `appendPayload` (given) writes the payload. Your job is the frame around it:

1. Remember `start := len(dst)`, then append `headerSize` zero bytes as a placeholder.
2. `dst = appendPayload(dst, r)`; the payload is `dst[start+headerSize:]`.
3. Write `crc32.Checksum(payload, crcTable)` into `dst[start:start+4]` and `len(payload)` into `dst[start+4:start+8]` with `binary.LittleEndian.PutUint32`.

`encode` **appends**: bytes already in `dst` must survive. The writer relies on that to reuse one buffer for every record.
<!-- /lang -->
<!-- lang: python -->
### `TODO(2.1)` — `encode`

In `lsmkv/wal/record.py`. `append_payload` (given) writes the payload. Your job is the frame around it:

1. Remember `start = len(dst)`, then extend `dst` by `HEADER_SIZE` zero bytes as a placeholder.
2. `append_payload(dst, r)`; the payload is `dst[start+HEADER_SIZE:]`.
3. Write `crc32c.checksum(payload)` into `dst[start:start+4]` and `len(payload)` into `dst[start+4:start+8]` with `struct.pack_into('<I', ...)`.

`encode` **appends**: bytes already in `dst` must survive. The writer relies on that to reuse one buffer for every record.
<!-- /lang -->
<!-- lang: cpp -->
### `TODO(2.1)` — `Encode`

In `src/wal/record.cc`. `AppendPayload` (given) writes the payload. Your job is the frame around it:

1. Remember `start = dst->size()`, then append `kHeaderSize` zero bytes as a placeholder.
2. `AppendPayload(dst, r)`; the payload is the bytes after the placeholder.
3. Write `Checksum(payload)` into the first 4 bytes and the payload length into the next 4, both little-endian.

`Encode` **appends**: bytes already in `*dst` must survive. The writer relies on that to reuse one buffer for every record.
<!-- /lang -->

## Appending and fsync
<!-- mode: read-and-implement tasks:2.2 -->

### Write is not the same as durable

When `write()` returns, the bytes are in the **OS page cache**, not on the disk. A process crash keeps them (the kernel still has them). A power cut or kernel panic loses them. `fsync` asks the OS to push the file's data to the device and waits until it has.

| Mode | After `Append` returns, the record survives | Cost |
| --- | --- | --- |
| `SyncAlways` | a process crash **and** a power cut | one fsync per write (≈0.1–10 ms) |
| `SyncNever` | a process crash only | almost free |

Databases expose this choice: PostgreSQL's `synchronous_commit`, Redis's `appendfsync always | everysec | no`, RocksDB's `WriteOptions.sync`. Batching many writes into one fsync (group commit) is how production engines get both safety and speed. That is out of scope here.

> [!warn] One write per record
> Build the whole record in memory and write it with **one** `Write` call. Writing the header and the payload separately doubles the system calls and makes a torn record more likely. And do not wrap the file in a `bufio.Writer`: a buffered record is not in the file at all until the buffer flushes, so an acknowledged write could vanish with the process.

<!-- lang: go -->
### `TODO(2.2)` — `Append`

In `internal/wal/writer.go`:

1. `w.buf = encode(w.buf[:0], r)` reuses the buffer instead of allocating per record.
2. `n, err := w.f.Write(w.buf)`; add `n` to `w.size` even on error, then return the error if any.
3. If `w.mode == SyncAlways`, return `w.f.Sync()`.

`Create`, `OpenAppend`, `Size`, and `Close` are given.
<!-- /lang -->
<!-- lang: python -->
### `TODO(2.2)` — `append`

In `lsmkv/wal/writer.py`:

1. Clear `self._buf` and `encode(self._buf, r)` to reuse the buffer.
2. `n = self._f.write(self._buf)`; add `n` to `self._size`.
3. If `self._mode is SyncMode.ALWAYS`, `flush` and `os.fsync`.

`create`, `open_append`, `size`, and `close` are given.
<!-- /lang -->
<!-- lang: cpp -->
### `TODO(2.2)` — `Append`

In `src/wal/writer.cc`:

1. Clear `buf_` and `Encode(&buf_, r)` to reuse the buffer.
2. One `fwrite` of the buffer; add the bytes written to `size_`.
3. If `mode_ == SyncMode::kAlways`, fsync the file.

`Create`, `OpenAppend`, `Size`, and `Close` are given.
<!-- /lang -->

## Replay and the torn tail
<!-- mode: read-and-implement tasks:2.3 -->

### Read until the first bad record

Replay walks the file from offset 0. For each record it checks, in order:

```plaintext
  offset ─▶ ┌ header? ──── fewer than 8 bytes left ─────────▶ stop (torn tail)
            ├ length? ──── bigger than the bytes left ───────▶ stop (torn tail)
            ├ checksum? ── does not match the payload ───────▶ stop (torn tail)
            ├ payload? ─── does not decode ──────────────────▶ stop (torn tail)
            └ ok: hand the record to the caller, offset += 8 + length
```

The offset where replay stops is the **good** length of the log. Everything after it is a torn tail: the write that was in flight when the process died. That write was never acknowledged, so dropping it is correct.

> [!idea] Why stop instead of skipping
> A bad record could also be a bit flip in the middle of an old, healthy log. Skipping it would silently lose one write and keep the rest. Stopping loses everything after it. LevelDB and RocksDB let you choose (RocksDB's `wal_recovery_mode`). This engine always treats the first bad record as the end of the log, which is right for the common case: a crash during the last append.

<!-- lang: go -->
### `TODO(2.3)` — `Replay`

In `internal/wal/reader.go`. Reading the file and the missing-file case are given. Loop over `data`:

1. `rest := data[good:]`. If `len(rest) < headerSize`, return `good, nil`.
2. Read `sum` from `rest[0:4]` and `n` from `rest[4:8]` (`binary.LittleEndian.Uint32`). If `n > maxRecordSize` or the payload would run past the end of `rest`, stop.
3. `payload := rest[headerSize : headerSize+n]`. If `crc32.Checksum(payload, crcTable) != sum`, stop.
4. `r, err := decodePayload(payload)`; if it fails, stop.
5. Call `fn(r)`. If it returns an error, return `good, err`.
6. `good += headerSize + n`.

You will need to import `encoding/binary` and `hash/crc32`.
<!-- /lang -->
<!-- lang: python -->
### `TODO(2.3)` — `replay`

In `lsmkv/wal/reader.py`. Reading the file and the missing-file case are given. Loop over `data`:

1. `rest = data[good:]`. If `len(rest) < HEADER_SIZE`, return `good`.
2. Read `sum` and `n` from the header (`struct.unpack_from('<II', ...)`). If `n > MAX_RECORD_SIZE` or the payload would run past the end, stop.
3. Check `crc32c.checksum(payload) == sum`; otherwise stop.
4. `decode_payload(payload)`; if it fails, stop.
5. Call `fn(r)` (exceptions propagate).
6. `good += HEADER_SIZE + n`.
<!-- /lang -->
<!-- lang: cpp -->
### `TODO(2.3)` — `Replay`

In `src/wal/reader.cc`. Reading the file and the missing-file case are given. Loop over `data`:

1. If fewer than `kHeaderSize` bytes remain, return `good`.
2. Read little-endian `sum` and `n`. If `n > kMaxRecordSize` or the payload would run past the end, stop.
3. If `Checksum(payload) != sum`, stop.
4. `DecodePayload`; on `CorruptError`, stop.
5. Call `fn(r)`.
6. Advance `good` by `kHeaderSize + n`.
<!-- /lang -->

## Recovery in the engine
<!-- mode: read-and-implement tasks:2.4 -->

### Open: replay, cut, append

```plaintext
  Open(dir)
    ├─ memtable := empty
    ├─ good := Replay(wal.log, apply each record to memtable)
    ├─ truncate wal.log to good        ← cut the torn tail
    └─ keep wal.log open for appends
```

Cutting the tail matters. If the garbage stayed, the next record would be appended **after** it, and the next replay would stop at the garbage and never reach the new record. A write acknowledged after a crash would be lost on the second crash. One of the tests does exactly this.

<!-- lang: go -->
### `TODO(2.4)` — `recoverLog` and `commit`

In `internal/db/recover.go`. `Open` and `write` in `db.go` are given and call these two:

- `recoverLog` (called by `Open`): `path := filepath.Join(d.dir, walName)`, then `wal.Replay(path, ...)` with a callback that calls `apply(d.mem, r)`. Then `d.log, err = wal.OpenAppend(path, good, d.opts.Sync)`, which truncates to `good` and positions at the end.
- `commit` (called by `write`, which backs `Put` and `Delete` and already holds the lock): `d.log.Append(r)` first. Return its error if it fails. Only then `apply(d.mem, r)`.

You will need to import `path/filepath`. Later chapters keep this file exactly as you leave it: they flush and compact around it.

> [!scope] Locking
> One mutex covers the log append and the memtable update, so records reach the log in the same order they reach the memtable. Replay then rebuilds exactly the same state.
<!-- /lang -->
<!-- lang: python -->
### `TODO(2.4)` — `recover_log` and `commit`

In `lsmkv/db/recover.py`. `open_db` and `_write` in `db.py` are given and call these two:

- `recover_log`: `path = os.path.join(d.dir, WAL_NAME)`, then `replay(path, ...)` applying each record with `apply`. Then `d.log = open_append(path, good, d.opts.sync)`.
- `commit`: `d.log.append(r)` first; only then `apply(d.mem, r)`.

Later chapters keep this file exactly as you leave it.

> [!scope] Locking
> One lock covers the log append and the memtable update, so records reach the log in the same order they reach the memtable.
<!-- /lang -->
<!-- lang: cpp -->
### `TODO(2.4)` — `RecoverLog` and `Commit`

In `src/db/recover.cc`. `Open` and `Put`/`Delete` call these two:

- `RecoverLog`: replay `dir_ + "/" + kWalName`, applying each record with `Apply`. Then `log_.reset(OpenAppend(path, good, opts_.sync))`.
- `Commit`: `log_->Append(r)` first; only then `Apply(&mem_, r)`.

Later chapters keep this file exactly as you leave it.

> [!scope] Locking
> One mutex covers the log append and the memtable update, so records reach the log in the same order they reach the memtable.
<!-- /lang -->

## Prove it
<!-- mode: read-only -->

<!-- lang: go -->
```bash
make test     # every acceptance test
make race     # the same tests with the race detector
make run      # a REPL that keeps its data in ./data
```
<!-- /lang -->
<!-- lang: python -->
```bash
make test     # every acceptance test
make run      # a REPL that keeps its data in ./data
```
<!-- /lang -->
<!-- lang: cpp -->
```bash
make test     # every acceptance test
make asan     # the same tests under AddressSanitizer + UBSan
make run      # a REPL that keeps its data in ./data
```
<!-- /lang -->

Kill it and come back:

```plaintext
$ make run
> put order:1 paid
OK
> del order:1
OK
> put order:2 pending
OK
^C
$ make run
lsmkv: ... recovered 2 entries.
> get order:1
(not found)
> get order:2
"pending"
```

> [!check] Before you move on
> 1. A write is logged, then applied, then acknowledged. Never in another order.
> 2. `write()` puts bytes in the page cache; `fsync` puts them on the device.
> 3. Each record carries a length and a checksum, so replay can find where a crash cut the log.
> 4. Recovery truncates the torn tail before appending, or the next crash loses new writes.

### What is missing

The log only grows, and so does the memtable: every key the store has ever seen sits in RAM, and startup replays the entire history. Chapter 3 fixes both. When the memtable gets big, it is written to disk as a sorted, immutable **SSTable**, and the log is started fresh.
