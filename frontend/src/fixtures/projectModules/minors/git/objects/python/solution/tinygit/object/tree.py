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
    cp = sorted(entries, key=lambda e: e.name)
    buf = bytearray()
    for e in cp:
        if not e.name or "\x00" in e.name or "/" in e.name:
            raise ValueError(f"object: bad tree name {e.name!r}")
        if e.mode not in (MODE_FILE, MODE_TREE):
            raise ValueError(f"object: bad mode {e.mode!r}")
        buf.extend(f"{e.mode} {e.name}\x00".encode())
        buf.extend(e.hash.raw())
    return bytes(buf)


def decode_tree(content: bytes) -> list[TreeEntry]:
    """Parse a tree object body."""
    out: list[TreeEntry] = []
    i = 0
    while i < len(content):
        space = content.find(b" ", i)
        if space < 0:
            raise ValueError("object: bad tree entry")
        nul = content.find(b"\x00", space + 1)
        if nul < 0:
            raise ValueError("object: bad tree entry name")
        mode = content[i:space].decode()
        name = content[space + 1 : nul].decode()
        if nul + 1 + 20 > len(content):
            raise ValueError("object: truncated tree hash")
        h = Hash(content[nul + 1 : nul + 1 + 20])
        out.append(TreeEntry(mode=mode, name=name, hash=h))
        i = nul + 1 + 20
    return out


def put_tree(s: Store, entries: list[TreeEntry]) -> Hash:
    body = encode_tree(entries)
    return s.put(TYPE_TREE, body)


def get_tree(s: Store, h: Hash) -> list[TreeEntry]:
    typ, content = s.get(h)
    if typ != TYPE_TREE:
        raise _fmt_type(typ, TYPE_TREE)
    return decode_tree(content)
