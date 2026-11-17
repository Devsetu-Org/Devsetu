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
    rel = os.path.normpath(rel).replace("\\", "/")
    if rel == "." or _has_dot_dot(rel):
        raise ValueError(f"index: bad path {rel!r}")
    abs_path = os.path.join(r.root, *rel.split("/"))
    with open(abs_path, "rb") as f:
        data = f.read()
    h = put_blob(r.objects(), data)
    idx = load(r.index_path())
    idx.set(Entry(path=rel, mode=MODE_FILE, hash=h))
    save(r.index_path(), idx)
