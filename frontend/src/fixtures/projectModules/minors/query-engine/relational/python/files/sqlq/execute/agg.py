"""COUNT / SUM aggregation — chapter 5 student work."""

from __future__ import annotations

from typing import List

from sqlq.execute.row import Row
from sqlq.parse.ast import SelectItem


def Aggregate(rows: List[Row], items: List[SelectItem], group: list) -> List[Row]:
    # TODO(5.3): Bucket rows by the GROUP BY values. COUNT(*) is the bucket size.
    # SUM(expr) adds Eval(expr) for each row. No rows and no GROUP BY still yields one row of zeros.
    # Output names come from the alias, or from the call name when there is no alias.
    raise NotImplementedError("TODO(5.3): Aggregate")
