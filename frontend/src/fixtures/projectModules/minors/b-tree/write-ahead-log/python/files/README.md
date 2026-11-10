# btreekv

Chapter 3: the write-ahead log. Page after-images are logged before pages change.

```
btreekv/wal/record.py     encode framing          <- TODO 3.1
btreekv/wal/writer.py     append + fsync          <- TODO 3.2
btreekv/wal/reader.py     scan / replay           <- TODO 3.3
btreekv/db/recover.py     recover_log / commit    <- TODO 3.4
```

## Running

```
make test
make run
```
