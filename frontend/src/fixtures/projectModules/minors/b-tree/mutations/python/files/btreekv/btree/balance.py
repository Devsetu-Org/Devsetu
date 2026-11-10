"""Merge / redistribute helpers (given)."""

from __future__ import annotations

from .node import CAPACITY, Node


def underfull(n: Node) -> bool:
    return n.size() < CAPACITY // 4


def remove_leaf_at(n: Node, i: int) -> None:
    del n.keys[i]
    del n.vals[i]


def remove_child(n: Node, i: int) -> None:
    del n.keys[i]
    del n.children[i + 1]


def can_merge(left: Node, right: Node, sep: bytes) -> bool:
    total = left.size() + right.size()
    if not left.leaf:
        total += 2 + len(sep) + 4
    return total <= CAPACITY


def merge_nodes(left: Node, right: Node, sep: bytes) -> None:
    if left.leaf:
        left.keys.extend(right.keys)
        left.vals.extend(right.vals)
        left.next = right.next
        return
    left.keys.append(sep)
    left.keys.extend(right.keys)
    left.children.extend(right.children)


def redistribute(left: Node, right: Node, sep: bytes) -> bytes:
    nxt = left.next
    merge_nodes(left, right, sep)
    rn, new_sep = left.split()
    left.next = nxt
    right.leaf = rn.leaf
    right.keys = rn.keys
    right.vals = rn.vals
    right.children = rn.children
    right.next = rn.next
    return new_sep


# Attach underfull as method
Node.underfull = underfull  # type: ignore[attr-defined]
Node.remove_leaf_at = remove_leaf_at  # type: ignore[attr-defined]
Node.remove_child = remove_child  # type: ignore[attr-defined]
