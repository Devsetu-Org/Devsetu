"""Loose zlib object store."""
from __future__ import annotations

import os
import zlib
from pathlib import Path

from tinygit.object.hash import ZERO, Hash, hash_of
from tinygit.object.header import encode_header, split_header


class Store:
    """A loose-object directory (…/.tinygit/objects)."""

    def __init__(self, dir: str | Path) -> None:
        self.dir = str(dir)

    def path_for(self, h: Hash) -> str:
        hx = h.hex()
        return os.path.join(self.dir, hx[:2], hx[2:])

    def put(self, typ: str, content: bytes) -> Hash:
        """Write a zlib-compressed object and return its content hash."""
        # TODO(1.2)
        raise NotImplementedError("TODO(1.2)")

    def get(self, h: Hash) -> tuple[str, bytes]:
        """Read and inflate a loose object. Returns (type, content)."""
        # TODO(1.2)
        raise NotImplementedError("TODO(1.2)")
