"""Tree objects."""
from __future__ import annotations

from dataclasses import dataclass

from tinygit.object.hash import ZERO, Hash
from tinygit.object.store import Store

TYPE_TREE = "tree"
MODE_FILE = "100644"
MODE_TREE = "040000"


@dataclass
class TreeEntry:
    mode: str
    name: str
    hash: Hash


def _fmt_type(got: str, want: str) -> ValueError:
    return ValueError(f"object: want {want} got {got}")


def encode_tree(entries: list[TreeEntry]) -> bytes:
    """Serialize entries in Git tree format, sorted by name."""
    # TODO(1.4): encode_tree
    raise NotImplementedError("TODO(1.4): encode_tree")


def decode_tree(content: bytes) -> list[TreeEntry]:
    """Parse a tree object body."""
    # TODO(1.4): decode_tree
    raise NotImplementedError("TODO(1.4): decode_tree")


def put_tree(s: Store, entries: list[TreeEntry]) -> Hash:
    body = encode_tree(entries)
    return s.put(TYPE_TREE, body)


def get_tree(s: Store, h: Hash) -> list[TreeEntry]:
    typ, content = s.get(h)
    if typ != TYPE_TREE:
        raise _fmt_type(typ, TYPE_TREE)
    return decode_tree(content)
