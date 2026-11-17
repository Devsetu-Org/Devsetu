"""Public Put / Delete / Get API over the write-ahead log and the memtable."""

from __future__ import annotations

import os
import threading
from dataclasses import dataclass
from typing import Optional, Tuple

from lsmkv.memtable import Memtable, Result
from lsmkv.memtable.skiplist import Kind
from lsmkv.wal import Record, SyncMode, Writer


# The log file inside the data directory.
WAL_NAME = "wal.log"


class ErrClosed(Exception):
    """Returned by every call after close."""


@dataclass
class Options:
    """Tune a DB. The default fsyncs every write."""

    sync: SyncMode = SyncMode.ALWAYS


@dataclass
class Stats:
    """Describes the store for the REPL."""

    memtable_entries: int = 0
    memtable_bytes: int = 0
    wal_bytes: int = 0


class DB:
    """An open store in one directory. Safe for concurrent use."""

    def __init__(self, directory: str, opts: Options) -> None:
        self._mu = threading.Lock()
        self.dir = directory
        self.opts = opts
        self.mem = Memtable()
        self.log: Optional[Writer] = None

    def recover_log(self) -> None:
        """Rebuild self.mem from the log, then open it for appending with any
        torn tail cut off. Implemented in recover.py."""
        from . import recover as recover_mod

        recover_mod.recover_log(self)

    def commit(self, r: Record) -> None:
        """Append r to the log and only then apply it to the memtable.
        Implemented in recover.py. Caller holds self._mu.
        """
        from . import recover as recover_mod

        recover_mod.commit(self, r)

    def put(self, key: bytes, value: bytes) -> None:
        """Store value under key."""
        self._write(Record(kind=Kind.VALUE, key=key, value=value))

    def delete(self, key: bytes) -> None:
        """Remove key."""
        self._write(Record(kind=Kind.TOMBSTONE, key=key, value=None))

    def _write(self, r: Record) -> None:
        with self._mu:
            if self.log is None:
                raise ErrClosed("db: closed")
            self.commit(r)

    def get(self, key: bytes) -> Tuple[Optional[bytes], bool]:
        """Return (value, True) if key exists, else (None, False)."""
        with self._mu:
            if self.log is None:
                raise ErrClosed("db: closed")
            v, res = self.mem.get(key)
            if res is not Result.FOUND:
                return None, False
            return bytes(v) if v is not None else b"", True

    def stats(self) -> Stats:
        """Snapshot of the store's size."""
        with self._mu:
            s = Stats(
                memtable_entries=len(self.mem),
                memtable_bytes=self.mem.approximate_size(),
            )
            if self.log is not None:
                s.wal_bytes = self.log.size()
            return s

    def close(self) -> None:
        """Flush the log and release the directory."""
        with self._mu:
            if self.log is None:
                raise ErrClosed("db: closed")
            self.log.close()
            self.log = None


def apply(m: Memtable, r: Record) -> None:
    """Make one logged write visible in the memtable."""
    if r.kind is Kind.TOMBSTONE:
        m.delete(r.key)
    else:
        m.put(r.key, r.value or b"")


def open_db(directory: str, opts: Optional[Options] = None) -> DB:
    """Open the store in directory, creating it if needed, and recover every
    acknowledged write from the log.
    """
    if opts is None:
        opts = Options()
    os.makedirs(directory, exist_ok=True)
    d = DB(directory, opts)
    d.recover_log()
    return d
