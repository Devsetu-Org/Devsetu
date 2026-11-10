"""Insert helpers — student tasks 2.3, 2.4, 2.5."""

from __future__ import annotations

from typing import TYPE_CHECKING, Optional

from .node import Node

if TYPE_CHECKING:
    from .tree import Promoted, Tree


def leaf_put(self: Node, key: bytes, val: bytes) -> None:
    i, found = self.leaf_index(key)
    if found:
        self.vals[i] = val
        return
    self.keys.insert(i, key)
    self.vals.insert(i, val)


def split(self: Node) -> tuple[Node, bytes]:
    at = self.split_point()
    if self.leaf:
        right = Node(
            leaf=True,
            keys=list(self.keys[at:]),
            vals=list(self.vals[at:]),
            next=self.next,
        )
        self.keys = self.keys[:at]
        self.vals = self.vals[:at]
        return right, right.keys[0]
    sep = self.keys[at]
    right = Node(
        keys=list(self.keys[at + 1 :]),
        children=list(self.children[at + 1 :]),
    )
    self.keys = self.keys[:at]
    self.children = self.children[: at + 1]
    return right, sep


def insert_public(self: "Tree", key: bytes, val: bytes) -> None:
    from .tree import check_entry

    check_entry(key, val)
    root = self.io.root()
    if root == 0:
        leaf = Node(leaf=True, keys=[key], vals=[val])
        no = self.new_page(leaf)
        self.io.set_root(no)
        return
    up = self._insert(root, key, val)
    if up is None:
        return
    new_root = Node(keys=[up.sep], children=[root, up.right])
    no = self.new_page(new_root)
    self.io.set_root(no)


def insert_rec(self: "Tree", no: int, key: bytes, val: bytes) -> Optional["Promoted"]:
    from .tree import Promoted

    n = self.load(no)
    if n.leaf:
        n.leaf_put(key, val)
    else:
        i = n.child_index(key)
        up = self._insert(n.children[i], key, val)
        if up is None:
            return None
        n.insert_child(i, up.sep, up.right)
    if n.fits():
        self.store(no, n)
        return None
    right, sep = n.split()
    right_no = self.io.allocate()
    if n.leaf:
        n.next = right_no
    self.store(right_no, right)
    self.store(no, n)
    return Promoted(sep=sep, right=right_no)
