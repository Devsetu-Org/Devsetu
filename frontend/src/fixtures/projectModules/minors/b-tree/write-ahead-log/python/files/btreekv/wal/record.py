"""Record framing — student task 3.1."""

from __future__ import annotations

import struct
from dataclasses import dataclass, field
from enum import IntEnum

from btreekv.pager.page import crc32c

HEADER_SIZE = 8
MAX_RECORD_SIZE = 1 << 20


class Kind(IntEnum):
    PAGE = 1
    META = 2
    COMMIT = 3


@dataclass
class Record:
    kind: Kind
    page: int = 0
    data: bytes = field(default_factory=bytes)


class BadPayload(ValueError):
    pass


def _append_uvarint(dst: bytearray, n: int) -> None:
    while n >= 0x80:
        dst.append((n & 0x7F) | 0x80)
        n >>= 7
    dst.append(n)


def _read_uvarint(p: bytes, i: int) -> tuple[int, int]:
    result = 0
    shift = 0
    while True:
        if i >= len(p):
            raise BadPayload("wal: malformed record payload")
        b = p[i]
        i += 1
        result |= (b & 0x7F) << shift
        if b < 0x80:
            return result, i
        shift += 7
        if shift >= 64:
            raise BadPayload("wal: malformed record payload")


def append_payload(dst: bytearray, r: Record) -> bytearray:
    """Append r's payload: kind (1), page (4 LE), data length (uvarint), data."""
    dst.append(int(r.kind))
    dst.extend(struct.pack("<I", r.page))
    _append_uvarint(dst, len(r.data))
    dst.extend(r.data)
    return dst


def decode_payload(p: bytes) -> Record:
    if len(p) < 6:
        raise BadPayload("wal: malformed record payload")
    kind = Kind(p[0])
    if kind < Kind.PAGE or kind > Kind.COMMIT:
        raise BadPayload("wal: malformed record payload")
    page = struct.unpack_from("<I", p, 1)[0]
    n, i = _read_uvarint(p, 5)
    if len(p) - i != n:
        raise BadPayload("wal: malformed record payload")
    return Record(kind=kind, page=page, data=bytes(p[i:]))


def encode(dst: bytearray, r: Record) -> bytearray:
    """Append a framed record to dst and return it.

    ┌──────────────┬──────────────┬───────────────────────────┐
    │ crc32c  (4)  │ length  (4)  │ payload (length bytes)    │
    └──────────────┴──────────────┴───────────────────────────┘
    """
    # TODO(3.1): Remember start = len(dst), then append HEADER_SIZE zero bytes
    # as a placeholder. dst = append_payload(dst, r); the payload is
    # dst[start+HEADER_SIZE:]. Write crc32c(payload) into dst[start:start+4]
    # and len(payload) into dst[start+4:start+8] with struct.pack_into.
    # Return dst. Do not touch anything before start.
    raise NotImplementedError("TODO(3.1): encode")
