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
    # TODO(1.5): encode_commit
    raise NotImplementedError("TODO(1.5): encode_commit")


def decode_commit(content: bytes) -> Commit:
    """Parse a commit object body."""
    # TODO(1.5): decode_commit
    raise NotImplementedError("TODO(1.5): decode_commit")


def put_commit(s: Store, c: Commit) -> Hash:
    body = encode_commit(c)
    return s.put(TYPE_COMMIT, body)


def get_commit(s: Store, h: Hash) -> Commit:
    typ, content = s.get(h)
    if typ != TYPE_COMMIT:
        raise _fmt_type(typ, TYPE_COMMIT)
    return decode_commit(content)
