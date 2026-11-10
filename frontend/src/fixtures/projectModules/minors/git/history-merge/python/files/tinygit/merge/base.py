"""merge-base."""
from __future__ import annotations

from collections import deque

from tinygit.object.commit import get_commit
from tinygit.object.hash import ZERO, Hash
from tinygit.object.store import Store


def merge_base(s: Store, a: Hash, b: Hash) -> Hash:
    """Return a common ancestor of a and b (BFS from a, mark; walk b)."""
    # TODO(5.3): merge_base
    raise NotImplementedError("TODO(5.3): merge_base")

