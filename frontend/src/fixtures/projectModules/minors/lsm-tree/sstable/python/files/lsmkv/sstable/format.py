"""SSTable on-disk format helpers.

File layout:

    data blocks... | filter block (ch4) | index block | footer (40 bytes)

    entry       = kind u8 | uvarint keyLen | key | uvarint valueLen | value
    index entry = uvarint keyLen | lastKey | uvarint offset | uvarint length
    footer      = filter offset u64 | filter length u64 |
                  index offset u64  | index length u64  | magic u64

Integers in the footer are little-endian. A handle's length does not include
the block's trailer.
"""

from __future__ import annotations

import struct
from dataclasses import dataclass
from typing import List, Optional, Tuple

from lsmkv.memtable.skiplist import Kind
from lsmkv.wal import crc32c

FOOTER_SIZE = 40
TRAILER_SIZE = 4
MAGIC = 0x6C736D6B76737374  # "lsmkvsst"
DEFAULT_BLOCK_SIZE = 4096


class CorruptError(ValueError):
    """The file does not decode as a table."""


class OutOfOrderError(ValueError):
    """Add was called with a key not greater than the last."""


@dataclass
class Handle:
    offset: int = 0
    length: int = 0


@dataclass
class Entry:
    kind: Kind
    key: bytes
    value: Optional[bytes]


@dataclass
class IndexEntry:
    last_key: bytes
    handle: Handle


def _append_uvarint(buf: bytearray, n: int) -> None:
    while n >= 0x80:
        buf.append((n & 0x7F) | 0x80)
        n >>= 7
    buf.append(n)


def _read_uvarint(p: bytes, i: int) -> Tuple[int, int]:
    result = 0
    shift = 0
    while True:
        if i >= len(p):
            raise CorruptError("sstable: corrupt table")
        b = p[i]
        i += 1
        result |= (b & 0x7F) << shift
        if b < 0x80:
            return result, i
        shift += 7
        if shift >= 64:
            raise CorruptError("sstable: corrupt table")


def _read_bytes(p: bytes, i: int) -> Tuple[bytes, int]:
    n, i = _read_uvarint(p, i)
    if n > len(p) - i:
        raise CorruptError("sstable: corrupt table")
    return p[i : i + n], i + n


def append_entry(dst: bytearray, kind: Kind, key: bytes, value: Optional[bytes]) -> None:
    dst.append(int(kind.value))
    key = key or b""
    value = value or b""
    _append_uvarint(dst, len(key))
    dst.extend(key)
    _append_uvarint(dst, len(value))
    dst.extend(value)


def decode_block(b: bytes) -> List[Entry]:
    out: List[Entry] = []
    i = 0
    while i < len(b):
        try:
            kind = Kind(b[i])
        except ValueError as e:
            raise CorruptError("sstable: corrupt table") from e
        if kind not in (Kind.VALUE, Kind.TOMBSTONE):
            raise CorruptError("sstable: corrupt table")
        i += 1
        key, i = _read_bytes(b, i)
        value, i = _read_bytes(b, i)
        if kind is Kind.TOMBSTONE:
            value = None
        out.append(Entry(kind=kind, key=key, value=value))
    return out


def append_index_entry(dst: bytearray, last_key: bytes, h: Handle) -> None:
    _append_uvarint(dst, len(last_key))
    dst.extend(last_key)
    _append_uvarint(dst, h.offset)
    _append_uvarint(dst, h.length)


def decode_index(b: bytes) -> List[IndexEntry]:
    out: List[IndexEntry] = []
    i = 0
    while i < len(b):
        last_key, i = _read_bytes(b, i)
        offset, i = _read_uvarint(b, i)
        length, i = _read_uvarint(b, i)
        out.append(IndexEntry(last_key=last_key, handle=Handle(offset, length)))
    return out


def encode_footer(filter_h: Handle, index_h: Handle) -> bytes:
    return struct.pack(
        "<QQQQQ",
        filter_h.offset,
        filter_h.length,
        index_h.offset,
        index_h.length,
        MAGIC,
    )


def decode_footer(b: bytes) -> Tuple[Handle, Handle]:
    if len(b) != FOOTER_SIZE:
        raise CorruptError("sstable: corrupt table")
    fo, fl, io, il, magic = struct.unpack("<QQQQQ", b)
    if magic != MAGIC:
        raise CorruptError("sstable: corrupt table")
    return Handle(fo, fl), Handle(io, il)
