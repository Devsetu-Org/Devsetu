"""write-tree."""
from __future__ import annotations

from tinygit.index.codec import Entry, load
from tinygit.object.hash import Hash
from tinygit.object.store import Store
from tinygit.object.tree import MODE_TREE, TreeEntry, put_tree
from tinygit.repo import Repo


def write_tree(r: Repo) -> Hash:
    """Build a nested tree from the index and return the root tree hash."""
    idx = load(r.index_path())
    if not idx.entries:
        return put_tree(r.objects(), [])
    root: dict = {}
    for e in idx.entries:
        parts = e.path.split("/")
        cur = root
        for i, part in enumerate(parts):
            if i == len(parts) - 1:
                cur[part] = e
                continue
            nxt = cur.get(part)
            if nxt is None:
                m: dict = {}
                cur[part] = m
                cur = m
                continue
            if not isinstance(nxt, dict):
                raise ValueError(f"worktree: path conflict at {'/'.join(parts[: i + 1])}")
            cur = nxt
    return _write_node(r.objects(), root)


def _write_node(s: Store, node: dict) -> Hash:
    names = sorted(node.keys())
    entries: list[TreeEntry] = []
    for name in names:
        v = node[name]
        if isinstance(v, Entry):
            entries.append(TreeEntry(mode=v.mode, name=name, hash=v.hash))
        elif isinstance(v, dict):
            h = _write_node(s, v)
            entries.append(TreeEntry(mode=MODE_TREE, name=name, hash=h))
        else:
            raise ValueError("worktree: bad node type")
    return put_tree(s, entries)
