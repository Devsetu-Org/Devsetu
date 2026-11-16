"""COUNT / SUM aggregation — chapter 5 student work."""

from __future__ import annotations

from typing import List

from sqlq.execute.row import Row
from sqlq.parse.ast import SelectItem


def Aggregate(rows: List[Row], items: List[SelectItem], group: list) -> List[Row]:
    # TODO(5.3) — Aggregate
    raise NotImplementedError("TODO(5.3)")
