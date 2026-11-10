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
    # TODO(4.2): Require message. write_tree. Parent = resolve_head if present.
    # Author defaults to "tinygit <tinygit@devlabs>" plus unix time +0000.
    # put_commit, then update_ref HEAD to the new hash.
    # Imports: time, Commit, put_commit, ZERO, resolve_head, update_ref, write_tree.
    raise NotImplementedError("TODO(4.2): commit")
