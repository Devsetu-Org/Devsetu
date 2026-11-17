"""Clock eviction — student task 4.2."""

from __future__ import annotations

from typing import TYPE_CHECKING

from .pool import ErrPoolFull

if TYPE_CHECKING:
    from .pool import Pool


def victim(self: Pool) -> int:
    n = len(self.frames)
    for _ in range(2 * n):
        i = self.hand
        self.hand = (self.hand + 1) % n
        f = self.frames[i]
        if not f.used:
            return i
        if f.pins > 0:
            continue
        if f.ref:
            f.ref = False
            continue
        return i
    raise ErrPoolFull("buffer: every frame is pinned")
