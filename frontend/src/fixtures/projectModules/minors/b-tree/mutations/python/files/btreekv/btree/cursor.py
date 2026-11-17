"""Leaf cursor helpers for Scan (given)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from .node import ErrCorrupt
from .tree import Tree


@dataclass
class Leaf:
    keys: list[bytes]
    vals: list[bytes]
    next: int = 0


def seek_leaf(self: Tree, key: bytes) -> int:
    no, _ = self.find_leaf(key)
    return no


def read_leaf(self: Tree, no: int) -> Leaf:
    n = self.load(no)
    if not n.leaf:
        raise ErrCorrupt(f"page {no} is not a leaf")
    return Leaf(keys=n.keys, vals=n.vals, next=n.next)


Tree.seek_leaf = seek_leaf  # type: ignore[attr-defined]
Tree.read_leaf = read_leaf  # type: ignore[attr-defined]
