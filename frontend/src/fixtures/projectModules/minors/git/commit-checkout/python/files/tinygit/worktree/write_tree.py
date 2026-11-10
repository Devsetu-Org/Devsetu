"""write-tree."""
from __future__ import annotations

from tinygit.object.hash import Hash
from tinygit.repo import Repo


def write_tree(r: Repo) -> Hash:
    """Build a nested tree from the index and return the root tree hash."""
    # TODO(4.1): Load index. Build a nested map by splitting paths on "/".
    # Recursively put_tree: files are MODE_FILE entries; dirs become MODE_TREE children.
    # Imports: Entry, load from index.codec; MODE_TREE, TreeEntry, put_tree from object.tree; Store.
    raise NotImplementedError("TODO(4.1): write_tree")
