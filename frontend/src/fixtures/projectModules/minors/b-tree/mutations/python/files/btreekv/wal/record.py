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
    start = len(dst)
    dst.extend(bytes(HEADER_SIZE))
    dst = append_payload(dst, r)
    payload = memoryview(dst)[start + HEADER_SIZE :]
    struct.pack_into("<I", dst, start, crc32c(bytes(payload)))
    struct.pack_into("<I", dst, start + 4, len(payload))
    return dst
