"""SortRows / LimitRows — chapter 5 student work."""

from __future__ import annotations

from typing import List

from sqlq.execute.row import Row
from sqlq.parse.ast import OrderKey


def SortRows(rows: List[Row], keys: List[OrderKey]) -> None:
    # TODO(5.4) — SortRows
    raise NotImplementedError("TODO(5.4)")


def LimitRows(rows: List[Row], n: int) -> List[Row]:
    if n < 0 or n >= len(rows):
        return rows
    return rows[:n]
