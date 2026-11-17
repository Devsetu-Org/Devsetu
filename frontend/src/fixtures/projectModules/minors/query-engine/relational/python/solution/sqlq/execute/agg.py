"""COUNT / SUM aggregation — chapter 5 student work."""

from __future__ import annotations

from typing import Dict, List

from sqlq.catalog.catalog import Int, TypeInt, Value
from sqlq.execute.eval import Eval
from sqlq.execute.row import Row
from sqlq.parse.ast import Call, Name, SelectItem


def Aggregate(rows: List[Row], items: List[SelectItem], group: list) -> List[Row]:
    buckets: Dict[str, dict] = {}
    order: List[str] = []
    for row in rows:
        key = _group_key(row, group)
        b = buckets.get(key)
        if b is None:
            b = {"first": row, "count": 0, "sums": {}}
            buckets[key] = b
            order.append(key)
        b["count"] += 1
        for i, item in enumerate(items):
            call = item.expr
            if not isinstance(call, Call) or call.star or call.name != "sum":
                continue
            v = Eval(call.arg, row)
            if v.t != TypeInt:
                raise ValueError("SUM needs INT")
            b["sums"][i] = b["sums"].get(i, 0) + v.i
    if len(rows) == 0 and len(group) == 0:
        order = [""]
        buckets[""] = {"first": Row(), "count": 0, "sums": {}}
    out: List[Row] = []
    for key in order:
        b = buckets[key]
        out.append(_emit_group(b["first"], b["count"], b["sums"], items))
    return out


def _group_key(row: Row, group: list) -> str:
    if not group:
        return ""
    parts = []
    for e in group:
        v = Eval(e, row)
        parts.append(str(v))
    return "\0".join(parts)


def _emit_group(sample: Row, count: int, sums: dict, items: List[SelectItem]) -> Row:
    out = Row()
    for i, item in enumerate(items):
        name = item.alias
        if not name:
            if item.star:
                name = "*"
            else:
                name = Name(item.expr)
        if isinstance(item.expr, Call):
            call = item.expr
            if call.star or call.name == "count":
                v = Int(count)
            else:
                v = Int(sums.get(i, 0))
        else:
            if item.star:
                raise ValueError("SELECT * cannot be aggregated")
            v = Eval(item.expr, sample)
        out.cols.append(name)
        out.vals.append(v)
    return out
