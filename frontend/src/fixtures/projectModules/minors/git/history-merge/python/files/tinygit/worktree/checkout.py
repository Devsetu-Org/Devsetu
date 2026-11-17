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
    c = get_commit(r.objects(), commit)
    files = flatten(r.objects(), c.tree, "")
    idx = load(r.index_path())
    safety_check(r, idx, files)

    for e in idx.entries:
        if e.path not in files:
            abs_path = os.path.join(r.root, *e.path.split("/"))
            try:
                os.remove(abs_path)
            except FileNotFoundError:
                pass

    new_idx = Index()
    for path, h in files.items():
        data = get_blob(r.objects(), h)
        abs_path = os.path.join(r.root, *path.split("/"))
        os.makedirs(os.path.dirname(abs_path) or ".", exist_ok=True)
        # dirname of "a.txt" is "" — join root with "" is root; makedirs(".") ok
        parent = os.path.dirname(abs_path)
        if parent:
            os.makedirs(parent, exist_ok=True)
        with open(abs_path, "wb") as f:
            f.write(data)
        new_idx.set(Entry(path=path, mode=MODE_FILE, hash=h))
    save(r.index_path(), new_idx)
    write_detached_head(r, commit)


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
