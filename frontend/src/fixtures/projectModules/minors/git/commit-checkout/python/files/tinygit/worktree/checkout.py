"""checkout."""
from __future__ import annotations

import os

from tinygit.index.codec import Entry, Index, load, save
from tinygit.object.blob import get_blob
from tinygit.object.commit import get_commit
from tinygit.object.hash import Hash, hash_of
from tinygit.object.header import encode_header
from tinygit.object.blob import TYPE_BLOB
from tinygit.object.store import Store
from tinygit.object.tree import MODE_FILE, MODE_TREE, get_tree
from tinygit.ref.head import write_detached_head, write_symbolic_head
from tinygit.ref.ref import read
from tinygit.repo import Repo


def checkout(r: Repo, commit: Hash) -> None:
    """Materialize commit's tree into the worktree and update HEAD/index."""
    # TODO(4.3): checkout
    raise NotImplementedError("TODO(4.3): checkout")


def checkout_branch(r: Repo, branch: str) -> None:
    name = "refs/heads/" + branch
    h = read(r, name)
    checkout(r, h)
    write_symbolic_head(r, name)


def safety_check(r: Repo, idx: Index, target: dict[str, Hash]) -> None:
    for e in idx.entries:
        abs_path = os.path.join(r.root, *e.path.split("/"))
        try:
            with open(abs_path, "rb") as f:
                data = f.read()
        except FileNotFoundError:
            continue
        raw = encode_header(TYPE_BLOB, data)
        work_hash = hash_of(raw)
        if work_hash == e.hash:
            continue
        th = target.get(e.path)
        if th is not None and th == work_hash:
            continue
        if th is None or th != e.hash:
            raise ValueError(f"worktree: local changes would be overwritten: {e.path}")


def flatten(s: Store, tree: Hash, prefix: str) -> dict[str, Hash]:
    entries = get_tree(s, tree)
    out: dict[str, Hash] = {}
    for e in entries:
        path = e.name if not prefix else f"{prefix}/{e.name}"
        if e.mode == MODE_TREE:
            out.update(flatten(s, e.hash, path))
        elif e.mode == MODE_FILE:
            out[path] = e.hash
    return out
