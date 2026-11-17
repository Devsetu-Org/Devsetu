"""Commit objects."""
from __future__ import annotations

from dataclasses import dataclass, field

from tinygit.object.hash import ZERO, Hash, parse_hex
from tinygit.object.store import Store

TYPE_COMMIT = "commit"


@dataclass
class Commit:
    tree: Hash = field(default_factory=lambda: ZERO)
    parents: list[Hash] = field(default_factory=list)
    author: str = ""
    committer: str = ""
    message: str = ""


def _fmt_type(got: str, want: str) -> ValueError:
    return ValueError(f"object: want {want} got {got}")


def encode_commit(c: Commit) -> bytes:
    """Serialize a commit object body."""
    if c.tree.is_zero():
        raise ValueError("object: commit missing tree")
    if not c.author:
        raise ValueError("object: commit missing author")
    committer = c.committer or c.author
    lines = [f"tree {c.tree.hex()}\n"]
    for p in c.parents:
        lines.append(f"parent {p.hex()}\n")
    lines.append(f"author {c.author}\n")
    lines.append(f"committer {committer}\n")
    lines.append("\n")
    msg = c.message
    if not msg.endswith("\n"):
        msg += "\n"
    lines.append(msg)
    return "".join(lines).encode()


def decode_commit(content: bytes) -> Commit:
    """Parse a commit object body."""
    c = Commit()
    rest = content
    while True:
        nl = rest.find(b"\n")
        if nl < 0:
            raise ValueError("object: truncated commit")
        line = rest[:nl].decode()
        rest = rest[nl + 1 :]
        if line == "":
            c.message = rest.decode()
            break
        if " " not in line:
            raise ValueError(f"object: bad commit header {line!r}")
        key, val = line.split(" ", 1)
        if key == "tree":
            c.tree = parse_hex(val)
        elif key == "parent":
            c.parents.append(parse_hex(val))
        elif key == "author":
            c.author = val
        elif key == "committer":
            c.committer = val
    if c.tree.is_zero():
        raise ValueError("object: commit missing tree")
    return c


def put_commit(s: Store, c: Commit) -> Hash:
    body = encode_commit(c)
    return s.put(TYPE_COMMIT, body)


def get_commit(s: Store, h: Hash) -> Commit:
    typ, content = s.get(h)
    if typ != TYPE_COMMIT:
        raise _fmt_type(typ, TYPE_COMMIT)
    return decode_commit(content)
