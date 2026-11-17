"""tree diff."""
from __future__ import annotations

from dataclasses import dataclass

from tinygit.object.hash import ZERO, Hash
from tinygit.object.store import Store
from tinygit.object.tree import MODE_FILE, MODE_TREE, get_tree


@dataclass
class Change:
    path: str
    old: Hash
    new: Hash
    status: str  # A / M / D


def tree_diff(s: Store, a: Hash, b: Hash) -> list[Change]:
    """Compare two trees into a sorted change list."""
    left = flatten(s, a, "")
    right = flatten(s, b, "")
    paths = sorted(set(left) | set(right))
    out: list[Change] = []
    for p in paths:
        oh = left.get(p)
        nh = right.get(p)
        if oh is not None and nh is None:
            out.append(Change(path=p, old=oh, new=ZERO, status="D"))
        elif oh is None and nh is not None:
            out.append(Change(path=p, old=ZERO, new=nh, status="A"))
        elif oh != nh:
            out.append(Change(path=p, old=oh or ZERO, new=nh or ZERO, status="M"))
    return out


def flatten(s: Store, tree: Hash, prefix: str) -> dict[str, Hash]:
    if tree.is_zero():
        return {}
    entries = get_tree(s, tree)
    out: dict[str, Hash] = {}
    for e in entries:
        path = e.name if not prefix else f"{prefix}/{e.name}"
        if e.mode == MODE_TREE:
            out.update(flatten(s, e.hash, path))
        elif e.mode == MODE_FILE:
            out[path] = e.hash
    return out
