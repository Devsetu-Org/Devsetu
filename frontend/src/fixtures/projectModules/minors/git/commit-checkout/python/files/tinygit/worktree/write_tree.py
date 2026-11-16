"""write-tree."""
from __future__ import annotations

from tinygit.object.hash import Hash
from tinygit.repo import Repo


def write_tree(r: Repo) -> Hash:
    """Build a nested tree from the index and return the root tree hash."""
    # TODO(4.1)
    raise NotImplementedError("TODO(4.1)")
