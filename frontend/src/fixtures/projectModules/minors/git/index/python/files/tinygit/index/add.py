"""git add."""
from __future__ import annotations

import os

from tinygit.index.codec import Entry, load, save
from tinygit.object.blob import put_blob
from tinygit.object.tree import MODE_FILE
from tinygit.repo import Repo


def _has_dot_dot(p: str) -> bool:
    return any(part == ".." for part in p.split("/"))


def add(r: Repo, rel: str) -> None:
    """Stage the file at rel (repo-relative) into the index."""
    # TODO(3.2): add
    raise NotImplementedError("TODO(3.2): add")

