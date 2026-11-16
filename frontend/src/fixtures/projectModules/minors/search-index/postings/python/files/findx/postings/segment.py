"""On-disk posting segment codec (FNDX format)."""

from __future__ import annotations

import struct
from dataclasses import dataclass
from typing import BinaryIO, Dict, List, Tuple

from findx.postings.map import Map
from findx.postings.posting import Posting

MAGIC = b"FNDX"
VERSION = 1


@dataclass
class _Entry:
    off: int
    count: int


class Segment:
    """Read-only on-disk posting dictionary for one flush."""

    def __init__(self, directory: Dict[str, _Entry], data: bytes) -> None:
        self._dir = directory
        self._data = data

    def postings(self, term: str) -> Tuple[List[Posting], bool]:
        # TODO(2.3)
        _ = struct.unpack_from
        _ = Posting
        raise NotImplementedError("TODO(2.3)")

    def terms(self) -> List[str]:
        return sorted(self._dir.keys())

    def df(self, term: str) -> int:
        e = self._dir.get(term)
        return 0 if e is None else e.count


def write_segment(w: BinaryIO, m: Map) -> None:
    """Encode m as a segment into w. Terms are stored sorted.

    Layout (little-endian):
      magic "FNDX" (4) | version u32 | nTerms u32
      directory: for each term (sorted): nameLen u16 | name | dataOff u32 | count u32
      data: for each term in directory order: count × (docId u32 | tf u32)
    """
    # TODO(2.2)
    _ = struct.pack
    _ = MAGIC
    _ = VERSION
    _ = w
    _ = m
    raise NotImplementedError("TODO(2.2)")


def decode_segment(raw: bytes) -> Segment:
    """Parse a segment from bytes."""
    # TODO(2.3)
    _ = MAGIC
    _ = VERSION
    _ = raw
    _ = _Entry
    raise NotImplementedError("TODO(2.3)")


def open_segment(path: str) -> Segment:
    with open(path, "rb") as f:
        return decode_segment(f.read())
