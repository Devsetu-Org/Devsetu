"""Flush after the log — student task 4.3."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .pool import Frame, Pool


def flush_frame(self: Pool, f: Frame) -> None:
    if not f.dirty:
        return
    if self.log is not None and f.lsn > self.log.durable():
        self.log.sync()
    self.b.write_page(f.no, f.data)
    f.dirty = False
