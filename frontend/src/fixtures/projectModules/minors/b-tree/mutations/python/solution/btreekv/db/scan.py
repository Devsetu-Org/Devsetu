"""Scan — student task 5.4."""

from __future__ import annotations

import bisect
from typing import TYPE_CHECKING, Callable

from btreekv.btree import Tree
from btreekv.db.db import ErrClosed

if TYPE_CHECKING:
    from .db import DB


def scan(self: DB, start: bytes, end: bytes, fn: Callable[[bytes, bytes], bool]) -> None:
    with self._mu:
        if self.closed:
            raise ErrClosed("db: closed")
        tree = Tree(self.store)
        # ensure cursor helpers loaded
        from btreekv.btree import cursor as _cursor  # noqa: F401

        no = tree.seek_leaf(start or b"")
        while no != 0:
            leaf = tree.read_leaf(no)
            i = bisect.bisect_left(leaf.keys, start or b"")
            for j in range(i, len(leaf.keys)):
                if end and leaf.keys[j] >= end:
                    return
                if not fn(leaf.keys[j], leaf.vals[j]):
                    return
            no = leaf.next
