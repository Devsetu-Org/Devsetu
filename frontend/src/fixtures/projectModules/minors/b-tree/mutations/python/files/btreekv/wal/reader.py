"""WAL reader — student task 3.3 (scan)."""

from __future__ import annotations

import struct
from typing import Callable

from btreekv.pager.page import crc32c

from .record import HEADER_SIZE, MAX_RECORD_SIZE, BadPayload, Record, decode_payload


def replay(path: str, fn: Callable[[Record, int], None]) -> int:
    try:
        with open(path, "rb") as f:
            data = f.read()
    except FileNotFoundError:
        return 0
    return scan(data, fn)


def scan(data: bytes, fn: Callable[[Record, int], None]) -> int:
    good = 0
    while True:
        rest = data[good:]
        if len(rest) < HEADER_SIZE:
            return good
        checksum, n = struct.unpack_from("<II", rest, 0)
        if n > MAX_RECORD_SIZE or HEADER_SIZE + n > len(rest):
            return good
        payload = rest[HEADER_SIZE : HEADER_SIZE + n]
        if crc32c(payload) != checksum:
            return good
        try:
            r = decode_payload(bytes(payload))
        except BadPayload:
            return good
        end = good + HEADER_SIZE + n
        fn(r, end)
        good = end
