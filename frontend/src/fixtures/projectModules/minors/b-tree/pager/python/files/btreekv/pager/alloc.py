"""Allocate and Free — student tasks 1.3 and 1.4."""

from __future__ import annotations

from typing import TYPE_CHECKING

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
        # TODO(1.3): If self._meta.free_head != 0, pop it: read that page into a
        # PAGE_SIZE buffer, take the next pointer from decode_free_page, set
        # self._meta.free_head to it, and return the popped page number. Do not
        # write to disk: the freelist head only reaches the header on sync (or,
        # with a log, on replay).
        #
        # Otherwise return self._meta.page_count, write a blank page there with
        # write_page so the file really grows, and increment self._meta.page_count.
        raise NotImplementedError("TODO(1.3): allocate")


def free(self: Pager, no: int) -> None:
    """Put page no on the freelist so a later allocate can reuse it.

    The freed page becomes a free page that points at the old list head.
    Freeing a page twice corrupts the list; the layers above must not.
    """
    with self._mu:
        # TODO(1.4): Raise ErrBadPage if no is 0 or >= self._meta.page_count.
        # Build the page with encode_free_page(buf, self._meta.free_head) in a
        # PAGE_SIZE buffer, write_page it, and only then set
        # self._meta.free_head = no. The page is the new head; its next pointer
        # is the old head.
        raise NotImplementedError("TODO(1.4): free")
