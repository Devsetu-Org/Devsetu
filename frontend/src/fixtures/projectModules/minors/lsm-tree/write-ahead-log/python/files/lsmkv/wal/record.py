"""Record framing: an 8-byte header (CRC-32C, length) in front of the payload.

One record on disk:

    +-----------+-----------+-------------------+
    | crc32 u32 | len u32   | payload (len)     |
    +-----------+-----------+-------------------+

    payload = kind u8 | uvarint keyLen | key | uvarint valueLen | value

Integers are little-endian. The checksum (CRC-32C) covers the payload only;
a wrong length shows up as a payload that fails its checksum.
"""

from __future__ import annotations

import struct
from dataclasses import dataclass
from typing import Optional, Tuple

from lsmkv.memtable.skiplist import Kind

from . import crc32c

HEADER_SIZE = 8
# Rejects absurd lengths read from a damaged header before they turn into a
# huge allocation.
MAX_RECORD_SIZE = 64 << 20


class CorruptError(ValueError):
    """A record's bytes do not decode to a record."""


@dataclass
class Record:
    """One logged write."""

    kind: Kind
    key: bytes
    value: Optional[bytes] = None  # None for tombstones


def _append_uvarint(buf: bytearray, n: int) -> None:
    while n >= 0x80:
        buf.append((n & 0x7F) | 0x80)
        n >>= 7
    buf.append(n)


def _read_uvarint(p: bytes, i: int) -> Tuple[int, int]:
    """Return (value, new_index). Raises CorruptError on overflow/truncation."""
    result = 0
    shift = 0
    while True:
        if i >= len(p):
            raise CorruptError("wal: corrupt record")
        b = p[i]
        i += 1
        result |= (b & 0x7F) << shift
        if b < 0x80:
            return result, i
        shift += 7
        if shift >= 64:
            raise CorruptError("wal: corrupt record")


def append_payload(dst: bytearray, r: Record) -> None:
    """Append the payload encoding of r to dst."""
    dst.append(int(r.kind.value))
    key = r.key or b""
    value = r.value or b""
    _append_uvarint(dst, len(key))
    dst.extend(key)
    _append_uvarint(dst, len(value))
    dst.extend(value)


def _read_bytes(p: bytes, i: int) -> Tuple[bytes, int]:
    n, i = _read_uvarint(p, i)
    if n > len(p) - i:
        raise CorruptError("wal: corrupt record")
    return p[i : i + n], i + n


def decode_payload(p: bytes) -> Record:
    """Inverse of append_payload. Returned slices alias p."""
    if len(p) < 1:
        raise CorruptError("wal: corrupt record")
    try:
        kind = Kind(p[0])
    except ValueError as e:
        raise CorruptError("wal: corrupt record") from e
    if kind not in (Kind.VALUE, Kind.TOMBSTONE):
        raise CorruptError("wal: corrupt record")
    i = 1
    try:
        key, i = _read_bytes(p, i)
        value, i = _read_bytes(p, i)
    except CorruptError:
        raise
    if i != len(p):
        raise CorruptError("wal: corrupt record")
    if kind is Kind.TOMBSTONE:
        value = None
    return Record(kind=kind, key=key, value=value)


def encode(dst: bytearray, r: Record) -> bytearray:
    """Append the full on-disk form of r (header and payload) to dst.

    Returns dst. Appends: bytes already in dst must survive. The writer relies
    on that to reuse one buffer for every record.
    """
    # TODO(2.1): remember start = len(dst), then extend dst by HEADER_SIZE
    # zero bytes as a placeholder. append_payload(dst, r); the payload is
    # dst[start+HEADER_SIZE:]. Write crc32c.checksum(payload) into
    # dst[start:start+4] and len(payload) into dst[start+4:start+8] with
    # struct.pack_into('<I', ...). Never overwrite what was already in dst.
    raise NotImplementedError("TODO(2.1): encode")
