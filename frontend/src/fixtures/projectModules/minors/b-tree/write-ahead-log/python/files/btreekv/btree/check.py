"""Tree invariant checker for tests and the REPL."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from .node import Node
from .tree import MAX_DEPTH, Tree


@dataclass
class Stats:
    height: int = 0
    leaves: int = 0
    internal: int = 0
    keys: int = 0


@dataclass
class _Checker:
    t: Tree
    seen: dict = field(default_factory=dict)
    leaves: list = field(default_factory=list)
    nexts: list = field(default_factory=list)
    internal: int = 0
    keys: int = 0

    def walk(self, no: int, lo: Optional[bytes], hi: Optional[bytes], is_root: bool, depth: int) -> int:
        if depth > MAX_DEPTH:
            raise RuntimeError(f"btree check: deeper than {MAX_DEPTH} levels")
        if no == 0:
            raise RuntimeError("btree check: pointer to page 0")
        if no in self.seen:
            raise RuntimeError(f"btree check: page {no} is reachable twice")
        self.seen[no] = True
        n = self.t.load(no)
        if len(n.keys) == 0 and not (is_root and n.leaf):
            raise RuntimeError(f"btree check: page {no} is empty")
        for i, k in enumerate(n.keys):
            if i > 0 and n.keys[i - 1] >= k:
                raise RuntimeError(f"btree check: page {no} keys out of order at {i}")
            if lo is not None and k < lo:
                raise RuntimeError(f"btree check: page {no} key below lower bound")
            if hi is not None and k >= hi:
                raise RuntimeError(f"btree check: page {no} key not below upper bound")
        if n.leaf:
            self.leaves.append(no)
            self.nexts.append(n.next)
            self.keys += len(n.keys)
            return 1
        self.internal += 1
        height = 0
        for i, child in enumerate(n.children):
            clo, chi = lo, hi
            if i > 0:
                clo = n.keys[i - 1]
            if i < len(n.keys):
                chi = n.keys[i]
            h = self.walk(child, clo, chi, False, depth + 1)
            if i == 0:
                height = h
            elif h != height:
                raise RuntimeError(f"btree check: page {no} has children of different heights")
        return height + 1


def check_tree(t: Tree) -> Stats:
    root = t.io.root()
    if root == 0:
        return Stats()
    c = _Checker(t=t)
    h = c.walk(root, None, None, True, 0)
    for i, no in enumerate(c.leaves):
        want = 0
        if i + 1 < len(c.leaves):
            want = c.leaves[i + 1]
        if c.nexts[i] != want:
            raise RuntimeError(f"btree check: leaf {no} links to {c.nexts[i]}, want {want}")
    return Stats(height=h, leaves=len(c.leaves), internal=c.internal, keys=c.keys)


# Attach Check to Tree
Tree.check = check_tree  # type: ignore[attr-defined]
