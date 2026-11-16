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
    # TODO(1.1)
    raise NotImplementedError("TODO(1.1)")


def read_page(self: Pager, no: int, buf: bytearray | memoryview) -> None:
    """Fill buf (exactly PAGE_SIZE bytes) with page no and verify its checksum.

    A page that fails the check raises ErrChecksum; a page past the end of the
    file raises ErrBadPage.
    """
    # TODO(1.2)
    raise NotImplementedError("TODO(1.2)")
