"""Search helpers — student tasks 2.1 and 2.2."""

from __future__ import annotations

from typing import TYPE_CHECKING, Optional

if TYPE_CHECKING:
    from .node import Node
    from .tree import Tree


def child_index(self: Node, key: bytes) -> int:
    """Which child of internal node self a lookup for key descends into.

    The number of separators that are <= key. A key equal to a separator
    belongs to the right of it.
    """
    # TODO(2.1)
    raise NotImplementedError("TODO(2.1)")


def leaf_index(self: Node, key: bytes) -> tuple[int, bool]:
    """Position of key in leaf self, or where it would be inserted, and whether it is there."""
    # TODO(2.1)
    raise NotImplementedError("TODO(2.1)")


def find_leaf(self: Tree, key: bytes) -> tuple[int, Optional[Node]]:
    """Walk from the root to the leaf that holds, or would hold, key.

    Returns (page_no, leaf); for an empty tree both are 0 / None.
    """
    # TODO(2.2)
    raise NotImplementedError("TODO(2.2)")


def get(self: Tree, key: bytes) -> tuple[Optional[bytes], bool]:
    """Return (value, True) or (None, False) when the key is absent."""
    # TODO(2.2)
    raise NotImplementedError("TODO(2.2)")
