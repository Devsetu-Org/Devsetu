"""Build one SSTable. Add entries in strictly increasing key order, then Finish."""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import BinaryIO, Optional

from lsmkv.memtable.skiplist import Kind
from lsmkv.wal import crc32c

from .format import DEFAULT_BLOCK_SIZE, Handle, TRAILER_SIZE, append_entry


@dataclass
class WriterOptions:
    block_size: int = 0  # zero means DEFAULT_BLOCK_SIZE


class Writer:
    """Builds one table. A table is not readable until finish returns."""

    def __init__(self, f: BinaryIO, path: str, opts: WriterOptions) -> None:
        self.f = f
        self.path = path
        self.opts = opts
        self.offset = 0
        self.block = bytearray()
        self.index = bytearray()
        self.last_key = bytearray()
        self.entries = 0
        self._buf = bytearray()

    def write_block(self, b: bytes) -> Handle:
        """Write b followed by its CRC-32C trailer and return where b went."""
        h = Handle(offset=self.offset, length=len(b))
        trailer = crc32c.checksum(b).to_bytes(TRAILER_SIZE, "little")
        self.f.write(b)
        self.f.write(trailer)
        self.offset += len(b) + TRAILER_SIZE
        return h

    def add_public(self, kind: Kind, key: bytes, value: Optional[bytes]) -> None:
        """Add one entry. Keys must be strictly increasing."""
        self.add(kind, key, value)
        self.note_key(key)

    # Public name matching Go's Add
    def add_entry(self, kind: Kind, key: bytes, value: Optional[bytes] = None) -> None:
        self.add_public(kind, key, value)

    def Add(self, kind: Kind, key: bytes, value: Optional[bytes] = None) -> None:
        self.add_public(kind, key, value)

    def finish_public(self) -> None:
        self.flush_block()
        filt = self.write_filter()
        self.finish(filt)

    def Finish(self) -> None:
        self.finish_public()

    def note_key(self, key: bytes) -> None:
        """Chapter 4 builds a Bloom filter here."""

    def write_filter(self) -> Handle:
        """Chapter 4 writes the filter block here. Until then: empty handle."""
        return Handle()

    def abort(self) -> None:
        self.f.close()
        try:
            os.remove(self.path)
        except OSError:
            pass

    # Student-owned (build.py)
    def add(self, kind: Kind, key: bytes, value: Optional[bytes]) -> None:
        from . import build as build_mod

        build_mod.add(self, kind, key, value)

    def flush_block(self) -> None:
        from . import build as build_mod

        build_mod.flush_block(self)

    def finish(self, filter_h: Handle) -> None:
        from . import build as build_mod

        build_mod.finish(self, filter_h)


def create(path: str, opts: Optional[WriterOptions] = None) -> Writer:
    if opts is None:
        opts = WriterOptions()
    if opts.block_size <= 0:
        opts = WriterOptions(block_size=DEFAULT_BLOCK_SIZE)
    f = open(path, "wb", buffering=64 << 10)
    return Writer(f, path, opts)
