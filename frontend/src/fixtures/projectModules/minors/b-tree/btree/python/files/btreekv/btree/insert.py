"""Insert helpers — student tasks 2.3, 2.4, 2.5."""

from __future__ import annotations

from typing import TYPE_CHECKING, Optional

if TYPE_CHECKING:
    from .node import Node
    from .tree import Promoted, Tree


def leaf_put(self: Node, key: bytes, val: bytes) -> None:
    """Store key -> val in leaf self, keeping keys sorted. Overwrite existing."""
    # TODO(2.3)
    raise NotImplementedError("TODO(2.3)")


def split(self: Node) -> tuple[Node, bytes]:
    """Cut an overfull node in two. self keeps the left; return (right, sep)."""
    # TODO(2.4)
    raise NotImplementedError("TODO(2.4)")


def insert_public(self: Tree, key: bytes, val: bytes) -> None:
    """Store val under key, overwriting any existing value."""
    # TODO(2.5)
    raise NotImplementedError("TODO(2.5)")


def insert_rec(self: Tree, no: int, key: bytes, val: bytes) -> Optional[Promoted]:
    """Add key beneath page no. Return promoted separator when the page splits."""
    # TODO(2.5)
    raise NotImplementedError("TODO(2.5)")
