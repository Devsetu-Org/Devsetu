"""Pin / Unpin — student task 4.1."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .pool import Frame, Pool


def pin(self: Pool, no: int, load: bool) -> Frame:
    with self._mu:
        # TODO(4.1): Hit: if no in self.table, raise pins, set ref, return frame.
        # Miss: i = self.victim(); if frame used, flush_frame then drop from table.
        # If load, self.b.read_page(no, f.data). Claim the frame.
        raise NotImplementedError("TODO(4.1): pin")


def unpin(self: Pool, f: Frame, dirty: bool) -> None:
    with self._mu:
        # TODO(4.1): Panic if pins already 0. Else pins--. If dirty, set dirty and lsn.
        raise NotImplementedError("TODO(4.1): unpin")
