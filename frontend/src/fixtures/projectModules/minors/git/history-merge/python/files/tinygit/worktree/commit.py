"""commit."""
from __future__ import annotations

import time
from dataclasses import dataclass

from tinygit.object.commit import Commit, put_commit
from tinygit.object.hash import ZERO, Hash
from tinygit.ref.head import resolve_head
from tinygit.ref.update import update_ref
from tinygit.repo import Repo
from tinygit.worktree.write_tree import write_tree


@dataclass
class CommitOpts:
    message: str = ""
    author: str = ""


def commit(r: Repo, opts: CommitOpts) -> Hash:
    """Write a tree from the index, create a commit, and advance HEAD."""
    if not opts.message:
        raise ValueError("worktree: empty commit message")
    tree = write_tree(r)
    parents: list[Hash] = []
    try:
        parent = resolve_head(r)
        if not parent.is_zero():
            parents = [parent]
    except FileNotFoundError:
        pass
    author = opts.author or "tinygit <tinygit@devlabs>"
    stamp = f"{author} {int(time.time())} +0000"
    c = Commit(tree=tree, parents=parents, author=stamp, committer=stamp, message=opts.message)
    h = put_commit(r.objects(), c)
    update_ref(r, "HEAD", h, ZERO)
    return h
