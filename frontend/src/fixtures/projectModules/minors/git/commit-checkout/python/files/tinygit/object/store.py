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
        raw = encode_header(typ, content)
        h = hash_of(raw)
        path = self.path_for(h)
        if os.path.exists(path):
            return h
        os.makedirs(os.path.dirname(path), exist_ok=True)
        compressed = zlib.compress(raw)
        tmp = path + ".tmp"
        with open(tmp, "wb") as f:
            f.write(compressed)
        os.rename(tmp, path)
        return h

    def get(self, h: Hash) -> tuple[str, bytes]:
        """Read and inflate a loose object. Returns (type, content)."""
        path = self.path_for(h)
        with open(path, "rb") as f:
            compressed = f.read()
        try:
            raw = zlib.decompress(compressed)
        except zlib.error as e:
            raise ValueError(f"object: zlib: {e}") from e
        typ, content = split_header(raw)
        if hash_of(raw) != h:
            raise ValueError(f"object: hash mismatch for {h}")
        return typ, content
