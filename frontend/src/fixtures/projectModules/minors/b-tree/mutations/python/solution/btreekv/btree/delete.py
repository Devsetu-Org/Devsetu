"""Delete / rebalance — student tasks 5.1–5.3."""

from __future__ import annotations

from typing import TYPE_CHECKING

from . import balance as _balance
from .balance import can_merge, merge_nodes, redistribute

if TYPE_CHECKING:
    from .node import Node
    from .tree import Tree


def delete_rec(self: Tree, no: int, key: bytes) -> tuple[bool, bool]:
    n = self.load(no)
    if n.leaf:
        i, ok = n.leaf_index(key)
        if not ok:
            return False, False
        n.remove_leaf_at(i)
        self.store(no, n)
        return True, n.underfull()
    i = n.child_index(key)
    found, child_under = self._delete(n.children[i], key)
    if not found or not child_under:
        return found, False
    self.rebalance(no, n, i)
    return True, n.underfull()


def rebalance(self: Tree, parent_no: int, parent: Node, i: int) -> None:
    li = i - 1 if i > 0 else i
    left_no, right_no = parent.children[li], parent.children[li + 1]
    sep = parent.keys[li]
    left = self.load(left_no)
    right = self.load(right_no)
    if can_merge(left, right, sep):
        merge_nodes(left, right, sep)
        self.store(left_no, left)
        self.io.free(right_no)
        parent.remove_child(li)
    else:
        parent.keys[li] = redistribute(left, right, sep)
        self.store(left_no, left)
        self.store(right_no, right)
    self.store(parent_no, parent)


def delete_public(self: Tree, key: bytes) -> bool:
    root = self.io.root()
    if root == 0 or len(key) == 0:
        return False
    found, _ = self._delete(root, key)
    if not found:
        return False
    while True:
        root = self.io.root()
        if root == 0:
            return True
        n = self.load(root)
        if n.leaf and len(n.keys) == 0:
            self.io.set_root(0)
        elif (not n.leaf) and len(n.keys) == 0:
            self.io.set_root(n.children[0])
        else:
            return True
        self.io.free(root)
