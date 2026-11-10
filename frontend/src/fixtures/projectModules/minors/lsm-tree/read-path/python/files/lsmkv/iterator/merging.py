"""Merge sorted sources into one sorted stream."""

from __future__ import annotations

import heapq
from typing import Any, List, Optional, Protocol

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
        # TODO(4.3): smaller key first; equal keys -> lower rank (newer) first.
        raise NotImplementedError("TODO(4.3): Less")


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
        # TODO(4.3): advance past current key in every child that holds it.
        raise NotImplementedError("TODO(4.3): Next")
