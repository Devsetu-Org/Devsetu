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
        # TODO(2.3): Look up term in self._dir. Read count postings from self._data
        # at off: each posting is doc_id u32 then tf u32 (little-endian).
        _ = struct.unpack_from
        _ = Posting
        raise NotImplementedError("TODO(2.3): Segment.postings")

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
    # TODO(2.2): For each term from m.terms_sorted(), append count×(doc_id,tf) to a
    # data buffer and a directory entry. Write the 12-byte header, then the
    # directory, then the data. Use struct.pack("<I", ...) / struct.pack("<H", ...).
    _ = struct.pack
    _ = MAGIC
    _ = VERSION
    _ = w
    _ = m
    raise NotImplementedError("TODO(2.2): write_segment")


def decode_segment(raw: bytes) -> Segment:
    """Parse a segment from bytes."""
    # TODO(2.3): Check magic and version. Read nTerms. Parse the directory into
    # a dict of _Entry. The remaining bytes are data. Return Segment(dir, data).
    _ = MAGIC
    _ = VERSION
    _ = raw
    _ = _Entry
    raise NotImplementedError("TODO(2.3): decode_segment")


def open_segment(path: str) -> Segment:
    with open(path, "rb") as f:
        return decode_segment(f.read())
