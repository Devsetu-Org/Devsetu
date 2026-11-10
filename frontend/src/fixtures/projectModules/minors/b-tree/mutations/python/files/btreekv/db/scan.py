"""Scan — student task 5.4."""

from __future__ import annotations

from typing import TYPE_CHECKING, Callable

if TYPE_CHECKING:
    from .db import DB


def scan(self: DB, start: bytes, end: bytes, fn: Callable[[bytes, bytes], bool]) -> None:
    # TODO(5.4): SeekLeaf(start), then walk leaf links calling fn until end or fn returns False.
    raise NotImplementedError("TODO(5.4): scan")
