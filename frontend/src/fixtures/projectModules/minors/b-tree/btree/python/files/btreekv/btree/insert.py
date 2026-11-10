"""Insert helpers — student tasks 2.3, 2.4, 2.5."""

from __future__ import annotations

from typing import TYPE_CHECKING, Optional

if TYPE_CHECKING:
    from .node import Node
    from .tree import Promoted, Tree


def leaf_put(self: Node, key: bytes, val: bytes) -> None:
    """Store key -> val in leaf self, keeping keys sorted. Overwrite existing."""
    # TODO(2.3): i, found := self.leaf_index(key). If found, replace self.vals[i].
    # Otherwise insert key into self.keys and val into self.vals at index i.
    raise NotImplementedError("TODO(2.3): leaf_put")


def split(self: Node) -> tuple[Node, bytes]:
    """Cut an overfull node in two. self keeps the left; return (right, sep)."""
    # TODO(2.4): at := self.split_point(). Leaf: right gets a copy of
    # keys[at:]/vals[at:] and next=self.next; self keeps [:at]; sep is right.keys[0].
    # Internal: sep = keys[at]; right gets keys[at+1:] and children[at+1:];
    # self keeps keys[:at] and children[:at+1].
    raise NotImplementedError("TODO(2.4): split")


def insert_public(self: Tree, key: bytes, val: bytes) -> None:
    """Store val under key, overwriting any existing value."""
    # TODO(2.5): check_entry(key, val) first. Empty tree (self.io.root() == 0):
    # make a leaf, new_page it, set_root. Otherwise up = self._insert(root, key, val).
    # If up is not None, the root split: build an internal node and set_root.
    raise NotImplementedError("TODO(2.5): Insert")


def insert_rec(self: Tree, no: int, key: bytes, val: bytes) -> Optional[Promoted]:
    """Add key beneath page no. Return promoted separator when the page splits."""
    # TODO(2.5): load, leaf_put or recurse+insert_child, then store or split.
    raise NotImplementedError("TODO(2.5): insert")
