"""Storage engine with write-ahead log."""

from __future__ import annotations

import os
import threading
from dataclasses import dataclass, field
from typing import Callable, Optional

from btreekv.btree import Tree
from btreekv.pager import Pager
from btreekv.buffer import Pool
from btreekv.wal import SyncMode, Writer

from .apply import apply_records
from .txn import Txn

DATA_NAME = "data.db"
WAL_NAME = "wal.log"


class ErrClosed(Exception):
    pass


class ErrNotYet(Exception):
    pass


@dataclass
class Options:
    sync: SyncMode = SyncMode.ALWAYS
    pool_frames: int = 0


@dataclass
class Stats:
    pages: int = 0
    free_pages: int = 0
    height: int = 0
    leaves: int = 0
    internal: int = 0
    keys: int = 0
    wal_bytes: int = 0
    resident: int = 0
    dirty: int = 0


class DB:
    def __init__(self, dir: str, opts: Options, pg: Pager):
        self._mu = threading.RLock()
        self.dir = dir
        self.opts = opts
        self.pg = pg
        self.pool: Pool | None = None
        self.store = pg
        self.log: Writer | None = None
        self.closed = False

    @classmethod
    def open(cls, dir: str, opts: Optional[Options] = None) -> DB:
        opts = opts or Options()
        os.makedirs(dir, exist_ok=True)
        pg = Pager.open(os.path.join(dir, DATA_NAME))
        frames = opts.pool_frames if opts.pool_frames > 0 else 256
        pool = Pool(pg, frames)
        d = cls(dir, opts, pg)
        d.pool = pool
        d.store = pool
        try:
            d.recover_log()
        except Exception:
            pg.close()
            raise
        pool.set_log(d.log)
        return d

    def update(self, fn: Callable[[Tree], None]) -> None:
        with self._mu:
            if self.closed:
                raise ErrClosed("db: closed")
            tx = Txn(self.store)
            try:
                fn(Tree(tx))
            except Exception:
                tx.abort()
                raise
            if not tx.dirty():
                return
            try:
                self.commit(tx)
            except Exception:
                tx.abort()
                raise

    def put(self, key: bytes, value: bytes) -> None:
        self.update(lambda t: t.insert(key, value))

    def get(self, key: bytes) -> tuple[Optional[bytes], bool]:
        with self._mu:
            if self.closed:
                raise ErrClosed("db: closed")
            return Tree(self.store).get(key)

    def delete(self, key: bytes) -> None:
        raise ErrNotYet("db: not built yet (chapter 5)")

    def scan(self, start: bytes, end: bytes, fn: Callable[[bytes, bytes], bool]) -> None:
        raise ErrNotYet("db: not built yet (chapter 5)")

    def stats(self) -> Stats:
        with self._mu:
            if self.closed:
                raise ErrClosed("db: closed")
            ts = Tree(self.store).check()
            pages = self.store.meta().page_count
            return Stats(
                pages=pages,
                free_pages=pages - 1 - ts.leaves - ts.internal,
                height=ts.height,
                leaves=ts.leaves,
                internal=ts.internal,
                keys=ts.keys,
                wal_bytes=self.log.size() if self.log else 0,
                resident=self.pool.resident() if self.pool else 0,
                dirty=self.pool.dirty_count() if self.pool else 0,
            )

    def checkpoint(self) -> None:
        assert self.pool is not None and self.log is not None
        self.pool.flush_all()
        self.pg.sync()
        self.log.reset()

    def close(self) -> None:
        with self._mu:
            if self.closed:
                raise ErrClosed("db: closed")
            self.closed = True
            self.checkpoint()
            if self.log:
                self.log.close()
            self.pg.close()

    recover_log = None  # type: ignore[assignment]
    commit = None  # type: ignore[assignment]


from . import recover as _recover  # noqa: E402

DB.recover_log = _recover.recover_log  # type: ignore[method-assign]
DB.commit = _recover.commit  # type: ignore[method-assign]
