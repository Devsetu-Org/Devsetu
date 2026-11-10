"""RunSelect builds and drains the operator tree."""

from __future__ import annotations

from typing import List

from sqlq.catalog.catalog import DB
from sqlq.execute.eval import Eval, Truth
from sqlq.execute.row import Filter, NewScan, Project, ReadAll, Row
from sqlq.parse.ast import Name, Select, SelectItem


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
    if sel.where is not None:
        pred = sel.where

        def _pred(row):
            return Truth(pred, row), None

        it = Filter(child=it, pred=_pred)
    rows = ReadAll(it)

    def _pick(row):
        return _project(sel.items, row)

    return ReadAll(Project(child=_SliceIter(rows), pick=_pick))


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
