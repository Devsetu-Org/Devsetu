"""git status."""
from __future__ import annotations

import os
from dataclasses import dataclass, field

from tinygit.index.codec import Entry, load
from tinygit.object.hash import Hash, hash_of
from tinygit.object.header import encode_header
from tinygit.object.blob import TYPE_BLOB
from tinygit.object.commit import get_commit
from tinygit.object.store import Store
from tinygit.object.tree import MODE_FILE, MODE_TREE, get_tree
from tinygit.ref.head import resolve_head
from tinygit.repo import Repo


@dataclass
class StatusBuckets:
    staged: list[str] = field(default_factory=list)
    modified: list[str] = field(default_factory=list)
    untracked: list[str] = field(default_factory=list)


def status(r: Repo) -> StatusBuckets:
    """Compare HEAD tree, index, and worktree."""
    idx = load(r.index_path())
    head_files = head_file_map(r)

    staged: list[str] = []
    modified: list[str] = []
    in_index: dict[str, Entry] = {}
    for e in idx.entries:
        in_index[e.path] = e
        hh = head_files.get(e.path)
        if hh is None or hh != e.hash:
            staged.append(e.path)
        abs_path = os.path.join(r.root, *e.path.split("/"))
        try:
            with open(abs_path, "rb") as f:
                data = f.read()
        except FileNotFoundError:
            modified.append(e.path)
            continue
        raw = encode_header(TYPE_BLOB, data)
        if hash_of(raw) != e.hash:
            modified.append(e.path)

    for path in head_files:
        if path not in in_index:
            staged.append(path)

    untracked = list_untracked(r.root, in_index)
    staged = unique(sorted(staged))
    modified = unique(sorted(modified))
    untracked = sorted(untracked)
    return StatusBuckets(staged=staged, modified=modified, untracked=untracked)


def unique(in_list: list[str]) -> list[str]:
    if not in_list:
        return in_list
    out = [in_list[0]]
    for i in range(1, len(in_list)):
        if in_list[i] != in_list[i - 1]:
            out.append(in_list[i])
    return out


def head_file_map(r: Repo) -> dict[str, Hash]:
    out: dict[str, Hash] = {}
    try:
        h = resolve_head(r)
    except (FileNotFoundError, ValueError, OSError):
        return out
    if h.is_zero():
        return out
    try:
        c = get_commit(r.objects(), h)
    except (FileNotFoundError, ValueError, OSError):
        return out
    return flatten_tree(r.objects(), c.tree, "")


def flatten_tree(s: Store, tree: Hash, prefix: str) -> dict[str, Hash]:
    entries = get_tree(s, tree)
    out: dict[str, Hash] = {}
    for e in entries:
        path = e.name if not prefix else f"{prefix}/{e.name}"
        if e.mode == MODE_TREE:
            out.update(flatten_tree(s, e.hash, path))
        elif e.mode == MODE_FILE:
            out[path] = e.hash
    return out


def list_untracked(root: str, in_index: dict[str, Entry]) -> list[str]:
    out: list[str] = []
    for dirpath, dirnames, filenames in os.walk(root):
        # prune .tinygit / .git
        dirnames[:] = [d for d in dirnames if d not in (".tinygit", ".git")]
        for name in filenames:
            abs_path = os.path.join(dirpath, name)
            rel = os.path.relpath(abs_path, root).replace(os.sep, "/")
            if rel == ".":
                continue
            if rel in in_index:
                continue
            out.append(rel)
    return out
