"""Blob objects."""
from __future__ import annotations

from tinygit.object.hash import Hash
from tinygit.object.store import Store

TYPE_BLOB = "blob"


def _fmt_type(got: str, want: str) -> ValueError:
    return ValueError(f"object: want {want} got {got}")


def put_blob(s: Store, data: bytes) -> Hash:
    """Store file bytes as a blob object."""
    # TODO(1.3): return s.put(TYPE_BLOB, data)
    raise NotImplementedError("TODO(1.3): put_blob")


def get_blob(s: Store, h: Hash) -> bytes:
    """Load a blob's bytes."""
    # TODO(1.3): typ, content = s.get(h); require typ == TYPE_BLOB; return content.
    raise NotImplementedError("TODO(1.3): get_blob")
