"""RunSelect builds and drains the operator tree."""

from __future__ import annotations

from typing import List

from sqlq.catalog.catalog import DB
from sqlq.execute.agg import Aggregate
from sqlq.execute.eval import Eval, Truth
from sqlq.execute.join import NewNestedLoop
from sqlq.execute.row import Filter, NewScan, Project, ReadAll, Row
from sqlq.execute.sort import LimitRows, SortRows
from sqlq.parse.ast import Call, Name, Select, SelectItem


class _SliceIter:
    def __init__(self, rows: List[Row]):
        self.rows = rows
        self.i = 0

    def Next(self):
        if self.i >= len(self.rows):
            return Row(), False, None
        row = self.rows[self.i]
        self.i += 1
        return row, True, None


def RunSelect(db: DB, sel: Select) -> List[Row]:
    left = db.Lookup(sel.from_table)
    qual = sel.alias if sel.alias else sel.from_table
    it = NewScan(left, qual)
    if sel.join is not None:
        right = db.Lookup(sel.join.table)
        rq = sel.join.alias if sel.join.alias else sel.join.table
        right_rows = ReadAll(NewScan(right, rq))
        it = NewNestedLoop(it, right_rows, sel.join.left, sel.join.right)
    if sel.where is not None:
        pred = sel.where

        def _pred(row):
            return Truth(pred, row), None

        it = Filter(child=it, pred=_pred)
    rows = ReadAll(it)
    if HasAggregate(sel):
        rows = Aggregate(rows, sel.items, sel.group)
    else:

        def _pick(row):
            return _project(sel.items, row)

        rows = ReadAll(Project(child=_SliceIter(rows), pick=_pick))
    if sel.order:
        SortRows(rows, sel.order)
    if sel.limit is not None:
        rows = LimitRows(rows, int(sel.limit))
    return rows


def _project(items: List[SelectItem], row: Row) -> Row:
    out = Row()
    for item in items:
        if item.star:
            out.cols.extend(row.cols)
            out.vals.extend(row.vals)
            continue
        v = Eval(item.expr, row)
        name = item.alias if item.alias else Name(item.expr)
        out.cols.append(name)
        out.vals.append(v)
    if not out.cols:
        raise ValueError("empty select list")
    return out


def HasAggregate(sel: Select) -> bool:
    if sel.group:
        return True
    for item in sel.items:
        if isinstance(item.expr, Call):
            return True
    return False
