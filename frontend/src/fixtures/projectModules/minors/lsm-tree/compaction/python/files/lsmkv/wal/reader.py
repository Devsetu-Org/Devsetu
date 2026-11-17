"""Replay intact records; stop at the first torn or corrupt one."""

from __future__ import annotations

import struct
from typing import Callable

from . import crc32c
from .record import (
    HEADER_SIZE,
    MAX_RECORD_SIZE,
    CorruptError,
    Record,
    decode_payload,
)


def replay(path: str, fn: Callable[[Record], None]) -> int:
    """Call fn for every intact record in the log at path, oldest first.

    Stops at the first record that is cut short or fails its checksum.
    Everything from there on is a torn tail: an append the crash interrupted,
    which was never acknowledged. Returns good, the offset just past the last
    intact record, so the caller can cut the tail off before appending.

    A missing file is an empty log. The slices in a Record alias the read
    buffer, so fn must copy anything it keeps (Memtable.put already does).
    """
    try:
        with open(path, "rb") as f:
            data = f.read()
    except FileNotFoundError:
        return 0
    good = 0
    while True:
        rest = data[good:]
        if len(rest) < HEADER_SIZE:
            return good
        (sum_, n) = struct.unpack_from("<II", rest, 0)
        if n > MAX_RECORD_SIZE or n > len(rest) - HEADER_SIZE:
            return good
        payload = rest[HEADER_SIZE : HEADER_SIZE + n]
        if crc32c.checksum(payload) != sum_:
            return good
        try:
            r = decode_payload(payload)
        except CorruptError:
            return good
        fn(r)
        good += HEADER_SIZE + n
