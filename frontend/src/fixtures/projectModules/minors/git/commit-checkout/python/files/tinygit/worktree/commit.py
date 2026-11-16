"""commit."""
from __future__ import annotations

from dataclasses import dataclass

from tinygit.object.hash import Hash
from tinygit.repo import Repo


@dataclass
class CommitOpts:
    message: str = ""
    author: str = ""


def commit(r: Repo, opts: CommitOpts) -> Hash:
    """Write a tree from the index, create a commit, and advance HEAD."""
    # TODO(4.2)
    raise NotImplementedError("TODO(4.2)")
