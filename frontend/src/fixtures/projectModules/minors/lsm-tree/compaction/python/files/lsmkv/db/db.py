"""Public Put / Delete / Get API over the WAL, memtable, and SSTables."""

from __future__ import annotations

import os
import re
import threading
from dataclasses import dataclass, field
from typing import List, Optional, Tuple

from lsmkv.memtable import Memtable, Result
from lsmkv.memtable.skiplist import Kind
from lsmkv.sstable import DEFAULT_BLOCK_SIZE, Table, WriterOptions, open_table
from lsmkv.wal import Record, SyncMode, Writer

WAL_NAME = "wal.log"
TABLE_EXT = ".sst"
TMP_EXT = ".tmp"


class ErrClosed(Exception):
    """Returned by every call after close."""


@dataclass
class Options:
    sync: SyncMode = SyncMode.ALWAYS
    memtable_size: int = 0  # zero => 4 MiB
    block_size: int = 0  # zero => DEFAULT_BLOCK_SIZE
    bloom_bits_per_key: int = 0  # zero => 10
    compaction_trigger: int = 0  # zero => 4

    def with_defaults(self) -> "Options":
        o = Options(sync=self.sync, memtable_size=self.memtable_size, block_size=self.block_size, bloom_bits_per_key=self.bloom_bits_per_key, compaction_trigger=self.compaction_trigger)
        if o.memtable_size <= 0:
            o.memtable_size = 4 << 20
        if o.block_size <= 0:
            o.block_size = DEFAULT_BLOCK_SIZE
        if o.bloom_bits_per_key == 0:
            o.bloom_bits_per_key = 10
        if o.compaction_trigger == 0:
            o.compaction_trigger = 4
        return o


@dataclass
class Stats:
    memtable_entries: int = 0
    memtable_bytes: int = 0
    wal_bytes: int = 0
    tables: int = 0


@dataclass
class TableRef:
    num: int
    t: Table


class DB:
    def __init__(self, directory: str, opts: Options) -> None:
        self._mu = threading.Lock()
        self.dir = directory
        self.opts = opts
        self.mem = Memtable()
        self.log: Optional[Writer] = None
        # newest first
        self.tables: List[TableRef] = []
        self.next_file = 1

    def recover_log(self) -> None:
        from . import recover as recover_mod

        recover_mod.recover_log(self)

    def commit(self, r: Record) -> None:
        from . import recover as recover_mod

        recover_mod.commit(self, r)

    def flush(self) -> None:
        from . import flush as flush_mod

        flush_mod.flush(self)

    def writer_options(self) -> WriterOptions:
        return WriterOptions(block_size=self.opts.block_size, bloom_bits_per_key=max(self.opts.bloom_bits_per_key, 0))

    def add_table(self, tb: TableRef) -> None:
        tables = [tb] + list(self.tables)
        self.save_manifest(tables)
        self.tables = tables

    def save_manifest(self, tables) -> None:
        from lsmkv.manifest import State, save as save_manifest
        st = State(next_file=self.next_file, tables=[x.num for x in tables])
        save_manifest(self.dir, st)

    def compact_range(self, lo: int, hi: int) -> None:
        from . import compact as compact_mod
        compact_mod.compact_range(self, lo, hi)

    def Compact(self) -> None:
        with self._mu:
            if self.log is None:
                raise ErrClosed("db: closed")
            if self.tables:
                self.compact_range(0, len(self.tables))

    def put(self, key: bytes, value: bytes) -> None:
        self._write(Record(kind=Kind.VALUE, key=key, value=value))

    def delete(self, key: bytes) -> None:
        self._write(Record(kind=Kind.TOMBSTONE, key=key, value=None))

    def _write(self, r: Record) -> None:
        with self._mu:
            if self.log is None:
                raise ErrClosed("db: closed")
            self.commit(r)
            if self.mem.approximate_size() >= self.opts.memtable_size:
                self.flush()
                if self.opts.compaction_trigger > 0 and len(self.tables) >= self.opts.compaction_trigger:
                    self.compact_range(0, len(self.tables))

    def scan(self, start, end, fn):
        with self._mu:
            if self.log is None:
                raise ErrClosed("db: closed")
            from . import scan as scan_mod
            scan_mod.scan(self, start, end, fn)

    def Flush(self) -> None:
        with self._mu:
            if self.log is None:
                raise ErrClosed("db: closed")
            self.flush()

    def flush_now(self) -> None:
        self.Flush()

    def get(self, key: bytes) -> Tuple[Optional[bytes], bool]:
        with self._mu:
            if self.log is None:
                raise ErrClosed("db: closed")
            v, res = self.mem.get(key)
            if res is Result.FOUND:
                return bytes(v) if v is not None else b"", True
            if res is Result.DELETED:
                return None, False
            for tb in self.tables:
                v, res = tb.t.get(key)
                if res is Result.FOUND:
                    return v, True
                if res is Result.DELETED:
                    return None, False
            return None, False

    def stats(self) -> Stats:
        with self._mu:
            s = Stats(
                memtable_entries=len(self.mem),
                memtable_bytes=self.mem.approximate_size(),
                tables=len(self.tables),
            )
            if self.log is not None:
                s.wal_bytes = self.log.size()
            return s

    def close(self) -> None:
        with self._mu:
            if self.log is None:
                raise ErrClosed("db: closed")
            self.log.close()
            self.log = None
            for tb in self.tables:
                tb.t.close()
            self.tables = []

    def open_tables(self) -> None:
        from lsmkv.manifest import load as load_manifest
        st = load_manifest(self.dir)
        self.next_file = st.next_file
        live = set()
        for num in st.tables:
            t = open_table(table_path(self.dir, num))
            self.tables.append(TableRef(num=num, t=t))
            live.add(num)
        for name in os.listdir(self.dir):
            if name.endswith(TMP_EXT):
                try: os.remove(os.path.join(self.dir, name))
                except OSError: pass
                continue
            if name.endswith(TABLE_EXT):
                stem = name[: -len(TABLE_EXT)]
                if re.fullmatch(r"\d+", stem):
                    num = int(stem)
                    if num not in live:
                        try: os.remove(os.path.join(self.dir, name))
                        except OSError: pass


def table_path(directory: str, num: int) -> str:
    return os.path.join(directory, f"{num:06d}{TABLE_EXT}")


def sync_dir(directory: str) -> None:
    fd = os.open(directory, os.O_RDONLY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def apply(m: Memtable, r: Record) -> None:
    if r.kind is Kind.TOMBSTONE:
        m.delete(r.key)
    else:
        m.put(r.key, r.value or b"")


def open_db(directory: str, opts: Optional[Options] = None) -> DB:
    if opts is None:
        opts = Options()
    opts = opts.with_defaults()
    os.makedirs(directory, exist_ok=True)
    d = DB(directory, opts)
    d.open_tables()
    try:
        d.recover_log()
    except Exception:
        for tb in d.tables:
            tb.t.close()
        raise
    return d
