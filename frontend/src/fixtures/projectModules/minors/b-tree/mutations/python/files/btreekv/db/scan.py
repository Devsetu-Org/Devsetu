"""Scan — student task 5.4."""

from __future__ import annotations

from typing import TYPE_CHECKING, Callable

if TYPE_CHECKING:
    from .db import DB


def scan(self: DB, start: bytes, end: bytes, fn: Callable[[bytes, bytes], bool]) -> None:
    # TODO(5.4)
    raise NotImplementedError("TODO(5.4)")
