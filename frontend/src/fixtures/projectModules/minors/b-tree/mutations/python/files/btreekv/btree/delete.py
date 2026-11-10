"""Delete / rebalance — student tasks 5.1–5.3."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .node import Node
    from .tree import Tree


def delete_rec(self: Tree, no: int, key: bytes) -> tuple[bool, bool]:
    # TODO(5.1)
    raise NotImplementedError("TODO(5.1): delete")


def rebalance(self: Tree, parent_no: int, parent: Node, i: int) -> None:
    # TODO(5.2)
    raise NotImplementedError("TODO(5.2): rebalance")


def delete_public(self: Tree, key: bytes) -> bool:
    # TODO(5.3)
    raise NotImplementedError("TODO(5.3): Delete")
