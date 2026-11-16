"""Blob objects."""
from __future__ import annotations

from tinygit.object.hash import Hash
from tinygit.object.store import Store

TYPE_BLOB = "blob"


def _fmt_type(got: str, want: str) -> ValueError:
    return ValueError(f"object: want {want} got {got}")


def put_blob(s: Store, data: bytes) -> Hash:
    """Store file bytes as a blob object."""
    # TODO(1.3)
    raise NotImplementedError("TODO(1.3)")


def get_blob(s: Store, h: Hash) -> bytes:
    """Load a blob's bytes."""
    # TODO(1.3)
    raise NotImplementedError("TODO(1.3)")
