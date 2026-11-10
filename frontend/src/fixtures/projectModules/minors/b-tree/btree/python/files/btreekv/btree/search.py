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
    # TODO(2.1): Binary search self.keys for the first separator that is
    # greater than key (bisect with a key comparison). That index is the
    # child to follow: separators at or below key send the search right.
    #
    # You will need to import bisect.
    raise NotImplementedError("TODO(2.1): child_index")


def leaf_index(self: Node, key: bytes) -> tuple[int, bool]:
    """Position of key in leaf self, or where it would be inserted, and whether it is there."""
    # TODO(2.1): Binary search self.keys for the first key >= key. It is a hit
    # when that index is in range and the keys match.
    raise NotImplementedError("TODO(2.1): leaf_index")


def find_leaf(self: Tree, key: bytes) -> tuple[int, Optional[Node]]:
    """Walk from the root to the leaf that holds, or would hold, key.

    Returns (page_no, leaf); for an empty tree both are 0 / None.
    """
    # TODO(2.2): Start at no := self.io.root(); if it is 0 the tree is empty,
    # return 0, None. Then loop at most MAX_DEPTH times: n = self.load(no); if
    # n.leaf return no, n; otherwise no = n.children[n.child_index(key)].
    # Running out of depth means a pointer cycle: raise ErrCorrupt.
    raise NotImplementedError("TODO(2.2): find_leaf")


def get(self: Tree, key: bytes) -> tuple[Optional[bytes], bool]:
    """Return (value, True) or (None, False) when the key is absent."""
    # TODO(2.2): Find the leaf with find_leaf (an empty tree gives a None leaf),
    # then look the key up with leaf_index. The leaf was decoded from the page,
    # so its value is already a private copy.
    raise NotImplementedError("TODO(2.2): get")
