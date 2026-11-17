"""Storage engine: public Put / Get API over the B+ tree."""

from __future__ import annotations

import os
import threading
from dataclasses import dataclass
from typing import Callable, Optional

from btreekv.btree import Tree
from btreekv.btree.check import Stats as TreeStats
from btreekv.pager import Pager

DATA_NAME = "data.db"


class ErrClosed(Exception):
    pass


class ErrNotYet(Exception):
    pass


@dataclass
class Options:
    pass


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
    def __init__(self, dir: str, opts: Options, pg: Pager, tree: Tree):
        self._mu = threading.RLock()
        self.dir = dir
        self.opts = opts
        self.pg = pg
        self.tree = tree
        self.closed = False

    @classmethod
    def open(cls, dir: str, opts: Optional[Options] = None) -> DB:
        opts = opts or Options()
        os.makedirs(dir, exist_ok=True)
        pg = Pager.open(os.path.join(dir, DATA_NAME))
        return cls(dir, opts, pg, Tree(pg))

    def put(self, key: bytes, value: bytes) -> None:
        with self._mu:
            if self.closed:
                raise ErrClosed("db: closed")
            self.tree.insert(key, value)

    def get(self, key: bytes) -> tuple[Optional[bytes], bool]:
        with self._mu:
            if self.closed:
                raise ErrClosed("db: closed")
            return self.tree.get(key)

    def delete(self, key: bytes) -> None:
        raise ErrNotYet("db: not built yet (chapter 5)")

    def scan(self, start: bytes, end: bytes, fn: Callable[[bytes, bytes], bool]) -> None:
        raise ErrNotYet("db: not built yet (chapter 5)")

    def stats(self) -> Stats:
        with self._mu:
            if self.closed:
                raise ErrClosed("db: closed")
            ts = self.tree.check()
            pages = self.pg.meta().page_count
            return Stats(
                pages=pages,
                free_pages=pages - 1 - ts.leaves - ts.internal,
                height=ts.height,
                leaves=ts.leaves,
                internal=ts.internal,
                keys=ts.keys,
            )

    def close(self) -> None:
        with self._mu:
            if self.closed:
                raise ErrClosed("db: closed")
            self.closed = True
            self.pg.close()
