"""Pin / Unpin — student task 4.1."""

from __future__ import annotations

from typing import TYPE_CHECKING

from .pool import Frame

if TYPE_CHECKING:
    from .pool import Pool


def pin(self: Pool, no: int, load: bool) -> Frame:
    with self._mu:
        if no in self.table:
            f = self.frames[self.table[no]]
            f.pins += 1
            f.ref = True
            return f
        i = self.victim()
        f = self.frames[i]
        if f.used:
            self.flush_frame(f)
            del self.table[f.no]
            f.used = False
        if load:
            self.b.read_page(no, f.data)
        f.no = no
        f.used = True
        f.ref = True
        f.pins = 1
        f.dirty = False
        f.lsn = 0
        self.table[no] = i
        return f


def unpin(self: Pool, f: Frame, dirty: bool) -> None:
    with self._mu:
        if f.pins == 0:
            raise RuntimeError("buffer: Unpin of a frame that is not pinned")
        f.pins -= 1
        if dirty:
            f.dirty = True
            f.lsn = self.log_size()
