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
        # TODO(1.3)
        raise NotImplementedError("TODO(1.3)")


def free(self: Pager, no: int) -> None:
    """Put page no on the freelist so a later allocate can reuse it.

    The freed page becomes a free page that points at the old list head.
    Freeing a page twice corrupts the list; the layers above must not.
    """
    with self._mu:
        # TODO(1.4)
        raise NotImplementedError("TODO(1.4)")
