"""Walk a table in key order, loading one data block at a time."""

from __future__ import annotations

import bisect
from typing import List, Optional

from lsmkv.memtable.skiplist import Kind

from .format import Entry, decode_block
from .reader import Table


class Iterator:
    def __init__(self, t: Table) -> None:
        self.t = t
        self.block = len(t.index)
        self.entries: List[Entry] = []
        self.pos = 0
        self.err: Optional[BaseException] = None

    def seek_to_first(self) -> None:
        self._load(0)
        self._skip_exhausted()

    def seek(self, target: bytes) -> None:
        keys = [e.last_key for e in self.t.index]
        i = bisect.bisect_left(keys, target)
        self._load(i)
        while self.pos < len(self.entries) and self.entries[self.pos].key < target:
            self.pos += 1
        self._skip_exhausted()

    def valid(self) -> bool:
        return self.pos < len(self.entries)

    def next(self) -> None:
        self.pos += 1
        self._skip_exhausted()

    def key(self) -> bytes:
        return self.entries[self.pos].key

    def value(self) -> Optional[bytes]:
        return self.entries[self.pos].value

    def kind(self) -> Kind:
        return self.entries[self.pos].kind

    def _load(self, i: int) -> None:
        self.block, self.entries, self.pos = i, [], 0
        if self.err is not None or i >= len(self.t.index):
            self.block = len(self.t.index)
            return
        try:
            raw = self.t.read_block(self.t.index[i].handle)
            self.entries = decode_block(raw)
        except BaseException as e:  # noqa: BLE001
            self.err, self.entries, self.block = e, [], len(self.t.index)

    def _skip_exhausted(self) -> None:
        while self.pos >= len(self.entries) and self.block < len(self.t.index):
            self._load(self.block + 1)
