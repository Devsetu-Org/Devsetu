"""Search helpers — student tasks 2.1 and 2.2."""

from __future__ import annotations

import bisect
from typing import TYPE_CHECKING, Optional

from .node import ErrCorrupt

if TYPE_CHECKING:
    from .node import Node
    from .tree import Tree

MAX_DEPTH = 64


def child_index(self: Node, key: bytes) -> int:
    return bisect.bisect_right(self.keys, key)


def leaf_index(self: Node, key: bytes) -> tuple[int, bool]:
    i = bisect.bisect_left(self.keys, key)
    return i, i < len(self.keys) and self.keys[i] == key


def find_leaf(self: Tree, key: bytes) -> tuple[int, Optional[Node]]:
    no = self.io.root()
    if no == 0:
        return 0, None
    for _ in range(MAX_DEPTH):
        n = self.load(no)
        if n.leaf:
            return no, n
        no = n.children[n.child_index(key)]
    raise ErrCorrupt("btree: corrupt page")


def get(self: Tree, key: bytes) -> tuple[Optional[bytes], bool]:
    _, leaf = self.find_leaf(key)
    if leaf is None:
        return None, False
    i, found = leaf.leaf_index(key)
    if not found:
        return None, False
    return leaf.vals[i], True
