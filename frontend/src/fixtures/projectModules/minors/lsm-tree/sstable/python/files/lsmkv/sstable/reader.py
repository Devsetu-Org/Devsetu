"""Open, immutable SSTable. Safe for concurrent use."""

from __future__ import annotations

import os
import threading
from typing import List, Optional, Tuple

from lsmkv.memtable import Result
from lsmkv.wal import crc32c

from .format import FOOTER_SIZE, Handle, IndexEntry, TRAILER_SIZE, CorruptError


class Table:
    def __init__(self) -> None:
        self.f = None  # type: ignore
        self.size = 0
        self.index: List[IndexEntry] = []
        self._block_reads = 0
        self._lock = threading.Lock()

    def load_filter(self, h: Handle) -> None:
        """Chapter 4 reads the Bloom filter here."""

    def may_contain(self, key: bytes) -> bool:
        """Chapter 4 queries the Bloom filter here. Until then: maybe."""
        return True

    def read_block(self, h: Handle) -> bytes:
        if h.offset + h.length + TRAILER_SIZE > self.size:
            raise CorruptError("sstable: corrupt table")
        self.f.seek(h.offset)
        buf = self.f.read(h.length + TRAILER_SIZE)
        if len(buf) != h.length + TRAILER_SIZE:
            raise CorruptError("sstable: corrupt table")
        with self._lock:
            self._block_reads += 1
        b, trailer = buf[: h.length], buf[h.length :]
        if crc32c.checksum(b) != int.from_bytes(trailer, "little"):
            raise CorruptError("sstable: corrupt table")
        return b

    def get(self, key: bytes) -> Tuple[Optional[bytes], Result]:
        if not self.may_contain(key):
            return None, Result.MISSING
        return self._get(key)

    def _get(self, key: bytes) -> Tuple[Optional[bytes], Result]:
        from . import lookup as lookup_mod

        return lookup_mod.get(self, key)

    def num_blocks(self) -> int:
        return len(self.index)

    def block_reads(self) -> int:
        with self._lock:
            return self._block_reads

    def close(self) -> None:
        if self.f is not None:
            self.f.close()
            self.f = None

    def new_iterator(self):
        from .iterator import Iterator

        return Iterator(self)


def open_table(path: str) -> Table:
    f = open(path, "rb")
    try:
        t, filt = _open(f)
        t.load_filter(filt)
        return t
    except Exception:
        f.close()
        raise


def _open(f):
    from . import lookup as lookup_mod

    return lookup_mod.open_table(f)
