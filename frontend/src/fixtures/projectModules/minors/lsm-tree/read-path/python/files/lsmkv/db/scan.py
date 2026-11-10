"""Student-owned: range scans over memtable + tables."""

from __future__ import annotations

from typing import TYPE_CHECKING, Callable, Optional

if TYPE_CHECKING:
    from .db import DB


def scan(d: "DB", start: Optional[bytes], end: Optional[bytes], fn: Callable[[bytes, bytes], bool]) -> None:
    """Call fn for every live key in [start, end), in key order, until fn returns False."""
    # TODO(4.4): merge memtable + table iterators newest-first; seek; skip tombstones.
    raise NotImplementedError("TODO(4.4): scan")
