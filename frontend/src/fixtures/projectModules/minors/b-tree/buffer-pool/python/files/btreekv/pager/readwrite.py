"""Checksummed page I/O — student tasks 1.1 and 1.2."""

from __future__ import annotations

import os
import struct
from typing import TYPE_CHECKING

from .page import (
    PAGE_SIZE,
    USABLE,
    ErrBadPage,
    ErrChecksum,
    check_buf,
    crc32c,
)

if TYPE_CHECKING:
    from .pager import Pager


def write_page(self: Pager, no: int, buf: bytes | bytearray) -> None:
    """Write buf (exactly PAGE_SIZE bytes) as page no.

    Only the first USABLE bytes are kept: the last TRAILER_SIZE bytes of the
    page on disk are a fresh CRC-32C of those bytes. Does not modify buf.
    """
    check_buf(buf)
    page = bytearray(PAGE_SIZE)
    page[:USABLE] = buf[:USABLE]
    struct.pack_into("<I", page, USABLE, crc32c(page[:USABLE]))
    os.pwrite(self._fd, page, no * PAGE_SIZE)


def read_page(self: Pager, no: int, buf: bytearray | memoryview) -> None:
    """Fill buf (exactly PAGE_SIZE bytes) with page no and verify its checksum.

    A page that fails the check raises ErrChecksum; a page past the end of the
    file raises ErrBadPage.
    """
    check_buf(buf)
    raw = os.pread(self._fd, PAGE_SIZE, no * PAGE_SIZE)
    if len(raw) < PAGE_SIZE:
        raise ErrBadPage(f"page {no} is past the end of the file")
    buf[:PAGE_SIZE] = raw
    want = struct.unpack_from("<I", buf, USABLE)[0]
    if crc32c(buf[:USABLE]) != want:
        raise ErrChecksum(f"page {no}")
