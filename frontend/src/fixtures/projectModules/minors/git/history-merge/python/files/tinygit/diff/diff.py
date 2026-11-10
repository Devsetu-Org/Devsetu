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
    # TODO(5.2): tree_diff
    raise NotImplementedError("TODO(5.2): tree_diff")


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
