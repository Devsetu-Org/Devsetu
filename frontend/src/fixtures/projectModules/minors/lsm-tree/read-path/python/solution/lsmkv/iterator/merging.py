"""Merge sorted sources into one sorted stream."""

from __future__ import annotations

import heapq
from typing import List, Optional, Protocol

from lsmkv.memtable.skiplist import Kind


class Iterator(Protocol):
    def seek_to_first(self) -> None: ...
    def seek(self, target: bytes) -> None: ...
    def valid(self) -> bool: ...
    def next(self) -> None: ...
    def key(self) -> bytes: ...
    def value(self) -> Optional[bytes]: ...
    def kind(self) -> Kind: ...


class _Item:
    __slots__ = ("it", "rank")

    def __init__(self, it: Iterator, rank: int) -> None:
        self.it = it
        self.rank = rank

    def __lt__(self, other: "_Item") -> bool:
        a, b = self.it.key(), other.it.key()
        if a != b:
            return a < b
        return self.rank < other.rank


class Merging:
    def __init__(self, *children: Iterator) -> None:
        self.children = list(children)
        self.h: List[_Item] = []

    def seek_to_first(self) -> None:
        for c in self.children:
            c.seek_to_first()
        self._rebuild()

    def seek(self, target: bytes) -> None:
        for c in self.children:
            c.seek(target)
        self._rebuild()

    def _rebuild(self) -> None:
        self.h = [_Item(c, i) for i, c in enumerate(self.children) if c.valid()]
        heapq.heapify(self.h)

    def valid(self) -> bool:
        return bool(self.h)

    def key(self) -> bytes:
        return self.h[0].it.key()

    def value(self) -> Optional[bytes]:
        return self.h[0].it.value()

    def kind(self) -> Kind:
        return self.h[0].it.kind()

    def next(self) -> None:
        key = bytes(self.h[0].it.key())
        while self.h and self.h[0].it.key() == key:
            item = self.h[0]
            item.it.next()
            if item.it.valid():
                heapq.heapreplace(self.h, item)
            else:
                heapq.heappop(self.h)
