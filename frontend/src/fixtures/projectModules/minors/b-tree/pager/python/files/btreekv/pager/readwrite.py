"""Checksummed page I/O — student tasks 1.1 and 1.2."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .pager import Pager


def write_page(self: Pager, no: int, buf: bytes | bytearray) -> None:
    """Write buf (exactly PAGE_SIZE bytes) as page no.

    Only the first USABLE bytes are kept: the last TRAILER_SIZE bytes of the
    page on disk are a fresh CRC-32C of those bytes. Does not modify buf.
    """
    # TODO(1.1): Call check_buf(buf) first. Copy buf[:USABLE] into a local
    # bytearray(PAGE_SIZE) page, store crc32c(page[:USABLE]) in page[USABLE:]
    # with struct.pack_into("<I", page, USABLE, ...), then write all of page
    # at offset no * PAGE_SIZE with os.pwrite(self._fd, page, offset).
    # Do not touch buf: callers reuse it.
    #
    # You will need to import os and struct, and pull PAGE_SIZE, USABLE,
    # check_buf, crc32c from .page.
    raise NotImplementedError("TODO(1.1): write_page")


def read_page(self: Pager, no: int, buf: bytearray | memoryview) -> None:
    """Fill buf (exactly PAGE_SIZE bytes) with page no and verify its checksum.

    A page that fails the check raises ErrChecksum; a page past the end of the
    file raises ErrBadPage.
    """
    # TODO(1.2): Call check_buf(buf) first, then os.pread(self._fd,
    # PAGE_SIZE, no * PAGE_SIZE). If fewer than PAGE_SIZE bytes came back,
    # raise ErrBadPage. Otherwise compare the trailer,
    # struct.unpack_from("<I", buf, USABLE)[0], with crc32c(buf[:USABLE]) and
    # raise ErrChecksum on a mismatch. Copy the read bytes into buf.
    #
    # You will need to import os and struct, and pull PAGE_SIZE, USABLE,
    # check_buf, crc32c, ErrChecksum, ErrBadPage from .page.
    raise NotImplementedError("TODO(1.2): read_page")
