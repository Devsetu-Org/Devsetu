"""Blob objects."""
from __future__ import annotations

from tinygit.object.hash import Hash
from tinygit.object.store import Store

TYPE_BLOB = "blob"


def _fmt_type(got: str, want: str) -> ValueError:
    return ValueError(f"object: want {want} got {got}")


def put_blob(s: Store, data: bytes) -> Hash:
    """Store file bytes as a blob object."""
    return s.put(TYPE_BLOB, data)


def get_blob(s: Store, h: Hash) -> bytes:
    """Load a blob's bytes."""
    typ, content = s.get(h)
    if typ != TYPE_BLOB:
        raise _fmt_type(typ, TYPE_BLOB)
    return content
