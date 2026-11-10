"""three-way merge."""
from __future__ import annotations

import os
from dataclasses import dataclass, field

from tinygit.index.codec import Entry, Index, save
from tinygit.merge.base import merge_base
from tinygit.object.blob import get_blob
from tinygit.object.commit import Commit, get_commit, put_commit
from tinygit.object.hash import ZERO, Hash
from tinygit.object.store import Store
from tinygit.object.tree import MODE_FILE, MODE_TREE, get_tree
from tinygit.ref.head import read_head, resolve_head, write_symbolic_head
from tinygit.ref.ref import read, write
from tinygit.ref.update import update_ref
from tinygit.repo import Repo
from tinygit.worktree.checkout import checkout
from tinygit.worktree.write_tree import write_tree

MARKER_OURS = "<<<<<<<"
MARKER_SEP = "======="
MARKER_THEIRS = ">>>>>>>"


@dataclass
class Result:
    commit: Hash = field(default_factory=lambda: ZERO)
    conflicts: list[str] = field(default_factory=list)
    fast_forward: bool = False


class MergeConflict(ValueError):
    def __init__(self, conflicts: list[str]) -> None:
        self.conflicts = conflicts
        super().__init__(f"merge: conflicts in {', '.join(conflicts)}")


def merge(r: Repo, their_branch: str) -> Result:
    """Merge their_branch into the current HEAD."""
    ours = resolve_head(r)
    theirs = read(r, "refs/heads/" + their_branch)
    base = merge_base(r.objects(), ours, theirs)
    if base == theirs:
        return Result(commit=ours)
    if base == ours:
        checkout(r, theirs)
        hd = read_head(r)
        if hd.symbolic:
            write(r, hd.symbolic, theirs)
            write_symbolic_head(r, hd.symbolic)
        return Result(commit=theirs, fast_forward=True)

    oc = get_commit(r.objects(), ours)
    tc = get_commit(r.objects(), theirs)
    bc = get_commit(r.objects(), base)
    obase = flatten(r.objects(), bc.tree, "")
    oours = flatten(r.objects(), oc.tree, "")
    otheirs = flatten(r.objects(), tc.tree, "")

    names = sorted(set(obase) | set(oours) | set(otheirs))
    conflicts: list[str] = []
    new_idx = Index()
    for p in names:
        bh = obase.get(p)
        oh = oours.get(p)
        th = otheirs.get(p)
        b_ok, o_ok, t_ok = bh is not None, oh is not None, th is not None

        if o_ok and t_ok and oh == th:
            new_idx.set(Entry(path=p, mode=MODE_FILE, hash=oh))
            write_blob_file(r, p, oh)
        elif not b_ok and o_ok and not t_ok:
            new_idx.set(Entry(path=p, mode=MODE_FILE, hash=oh))
            write_blob_file(r, p, oh)
        elif not b_ok and t_ok and not o_ok:
            new_idx.set(Entry(path=p, mode=MODE_FILE, hash=th))
            write_blob_file(r, p, th)
        elif b_ok and o_ok and not t_ok and oh == bh:
            abs_path = os.path.join(r.root, *p.split("/"))
            try:
                os.remove(abs_path)
            except FileNotFoundError:
                pass
        elif b_ok and t_ok and not o_ok and th == bh:
            pass
        elif b_ok and o_ok and not t_ok and oh != bh:
            conflicts.append(p)
            write_conflict(r, p, oh, ZERO)
        elif b_ok and t_ok and not o_ok and th != bh:
            conflicts.append(p)
            write_conflict(r, p, ZERO, th)
        elif o_ok and t_ok and oh != th:
            if b_ok and oh == bh:
                new_idx.set(Entry(path=p, mode=MODE_FILE, hash=th))
                write_blob_file(r, p, th)
            elif b_ok and th == bh:
                new_idx.set(Entry(path=p, mode=MODE_FILE, hash=oh))
                write_blob_file(r, p, oh)
            else:
                conflicts.append(p)
                write_conflict(r, p, oh, th)
        elif not o_ok and not t_ok:
            pass
        else:
            if o_ok:
                new_idx.set(Entry(path=p, mode=MODE_FILE, hash=oh))
                write_blob_file(r, p, oh)

    if conflicts:
        save(r.index_path(), new_idx)
        raise MergeConflict(conflicts)

    save(r.index_path(), new_idx)
    tree = write_tree(r)
    msg = f"Merge branch '{their_branch}'\n"
    stamp = "tinygit <tinygit@devlabs> 0 +0000"
    h = put_commit(
        r.objects(),
        Commit(tree=tree, parents=[ours, theirs], author=stamp, committer=stamp, message=msg),
    )
    update_ref(r, "HEAD", h, ZERO)
    return Result(commit=h)


def write_blob_file(r: Repo, path: str, h: Hash) -> None:
    data = get_blob(r.objects(), h)
    abs_path = os.path.join(r.root, *path.split("/"))
    parent = os.path.dirname(abs_path)
    if parent:
        os.makedirs(parent, exist_ok=True)
    with open(abs_path, "wb") as f:
        f.write(data)


def write_conflict(r: Repo, path: str, ours: Hash, theirs: Hash) -> None:
    ob = b""
    tb = b""
    if not ours.is_zero():
        ob = get_blob(r.objects(), ours)
    if not theirs.is_zero():
        tb = get_blob(r.objects(), theirs)
    parts = [f"{MARKER_OURS} ours\n".encode(), ob]
    if ob and not ob.endswith(b"\n"):
        parts.append(b"\n")
    parts.append(f"{MARKER_SEP}\n".encode())
    parts.append(tb)
    if tb and not tb.endswith(b"\n"):
        parts.append(b"\n")
    parts.append(f"{MARKER_THEIRS} theirs\n".encode())
    abs_path = os.path.join(r.root, *path.split("/"))
    parent = os.path.dirname(abs_path)
    if parent:
        os.makedirs(parent, exist_ok=True)
    with open(abs_path, "wb") as f:
        f.write(b"".join(parts))


def flatten(s: Store, tree: Hash, prefix: str) -> dict[str, Hash]:
    if tree.is_zero():
        return {}
    entries = get_tree(s, tree)
    out: dict[str, Hash] = {}
    for e in entries:
        path = e.name if not prefix else f"{prefix}/{e.name}"
        if e.mode == MODE_TREE:
            out.update(flatten(s, e.hash, path))
        elif e.mode == MODE_FILE:
            out[path] = e.hash
    return out
