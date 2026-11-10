"""Clock eviction — student task 4.2."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .pool import Pool


def victim(self: Pool) -> int:
    # TODO(4.2): Sweep the hand up to 2*len(frames). Unused -> take. Pinned -> skip.
    # Ref set -> clear and continue. Else return that index. Else ErrPoolFull.
    raise NotImplementedError("TODO(4.2): victim")
