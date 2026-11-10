"""SortRows / LimitRows — chapter 5 student work."""

from __future__ import annotations

from typing import List

from sqlq.execute.row import Row
from sqlq.parse.ast import OrderKey


def SortRows(rows: List[Row], keys: List[OrderKey]) -> None:
    # TODO(5.4): Each key names an output column (Name, or the ident). Stable sort.
    # Desc flips the comparison. A missing name is an error when there is at least one row.
    raise NotImplementedError("TODO(5.4): SortRows")


def LimitRows(rows: List[Row], n: int) -> List[Row]:
    if n < 0 or n >= len(rows):
        return rows
    return rows[:n]
