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
        e = self._dir.get(term)
        if e is None:
            return [], False
        out: List[Posting] = []
        base = e.off
        for i in range(e.count):
            o = base + i * 8
            doc_id, tf = struct.unpack_from("<II", self._data, o)
            out.append(Posting(doc_id=doc_id, tf=tf))
        return out, True

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
    terms = m.terms_sorted()
    dir_buf = bytearray()
    data_buf = bytearray()
    for term in terms:
        lst = m.postings(term)
        off = len(data_buf)
        for p in lst:
            data_buf += struct.pack("<II", p.doc_id, p.tf)
        name = term.encode("utf-8")
        if len(name) > 0xFFFF:
            raise ValueError(f"term too long: {term!r}")
        dir_buf += struct.pack("<H", len(name))
        dir_buf += name
        dir_buf += struct.pack("<II", off, len(lst))

    hdr = MAGIC + struct.pack("<II", VERSION, len(terms))
    w.write(hdr)
    w.write(dir_buf)
    w.write(data_buf)


def decode_segment(raw: bytes) -> Segment:
    """Parse a segment from bytes."""
    if len(raw) < 12 or raw[:4] != MAGIC:
        raise ValueError("bad segment magic")
    ver = struct.unpack_from("<I", raw, 4)[0]
    if ver != VERSION:
        raise ValueError(f"unsupported segment version {ver}")
    n_terms = struct.unpack_from("<I", raw, 8)[0]
    directory: Dict[str, _Entry] = {}
    i = 12
    max_end = 0
    for _ in range(n_terms):
        if i + 2 > len(raw):
            raise ValueError("truncated directory")
        nlen = struct.unpack_from("<H", raw, i)[0]
        i += 2
        if i + nlen + 8 > len(raw):
            raise ValueError("truncated term")
        name = raw[i : i + nlen].decode("utf-8")
        i += nlen
        off, count = struct.unpack_from("<II", raw, i)
        i += 8
        directory[name] = _Entry(off=off, count=count)
        end = off + count * 8
        if end > max_end:
            max_end = end
    data = raw[i:]
    if len(data) < max_end:
        raise ValueError("truncated posting data")
    return Segment(directory, data)


def open_segment(path: str) -> Segment:
    with open(path, "rb") as f:
        return decode_segment(f.read())
