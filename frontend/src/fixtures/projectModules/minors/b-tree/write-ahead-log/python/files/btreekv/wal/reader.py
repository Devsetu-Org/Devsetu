"""WAL reader — student task 3.3 (scan)."""

from __future__ import annotations

import os
import struct
from typing import Callable, Optional

from btreekv.pager.page import crc32c

from .record import HEADER_SIZE, MAX_RECORD_SIZE, Record, decode_payload


def replay(path: str, fn: Callable[[Record, int], None]) -> int:
    """Read the log from the start; return the good prefix length."""
    try:
        with open(path, "rb") as f:
            data = f.read()
    except FileNotFoundError:
        return 0
    return scan(data, fn)


def scan(data: bytes, fn: Callable[[Record, int], None]) -> int:
    """Walk intact records in data; stop at the first torn/bad one."""
    # TODO(3.3): Loop. If fewer than HEADER_SIZE bytes remain, return good.
    # Read crc and length from the header. If length is absurd or the payload
    # does not fit, return good. If crc32c(payload) != sum, return good. Decode
    # the payload; on BadPayload return good. Call fn(r, end) then advance.
    raise NotImplementedError("TODO(3.3): scan")
