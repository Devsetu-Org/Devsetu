"""Allocate and Free — student tasks 1.3 and 1.4."""

from __future__ import annotations

from typing import TYPE_CHECKING

from .page import PAGE_SIZE, ErrBadPage, decode_free_page, encode_free_page

if TYPE_CHECKING:
    from .pager import Pager


def allocate(self: Pager) -> int:
    """Return a page number nobody else is using.

    Reuses a freed page when the freelist has one and otherwise grows the file
    by one page. A recycled page keeps whatever bytes it had; callers write it
    before they read it. A page that grows the file is written blank so it
    exists on disk.
    """
    with self._mu:
        head = self._meta.free_head
        if head != 0:
            buf = bytearray(PAGE_SIZE)
            self.read_page(head, buf)
            nxt = decode_free_page(buf)
            self._meta.free_head = nxt
            return head
        no = self._meta.page_count
        self.write_page(no, bytearray(PAGE_SIZE))
        self._meta.page_count += 1
        return no


def free(self: Pager, no: int) -> None:
    """Put page no on the freelist so a later allocate can reuse it.

    The freed page becomes a free page that points at the old list head.
    Freeing a page twice corrupts the list; the layers above must not.
    """
    with self._mu:
        if no == 0 or no >= self._meta.page_count:
            raise ErrBadPage(f"cannot free page {no}")
        buf = bytearray(PAGE_SIZE)
        encode_free_page(buf, self._meta.free_head)
        self.write_page(no, buf)
        self._meta.free_head = no
