"""Nested-loop join — chapter 5 student work."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List

from sqlq.catalog.catalog import TypeBool, TypeInt, TypeText, Value
from sqlq.execute.eval import Eval
from sqlq.execute.row import Iter, Row


@dataclass
class NestedLoop:
    left: Iter
    right: List[Row]
    on_l: object
    on_r: object
    cur: Row = field(default_factory=Row)
    rj: int = 0
    primed: bool = False

    def Next(self):
        return nested_loop_next(self)


def NewNestedLoop(left, right, on_l, on_r) -> NestedLoop:
    return NestedLoop(left=left, right=right, on_l=on_l, on_r=on_r)


def nested_loop_next(n: NestedLoop):
    while True:
        if not n.primed or n.rj >= len(n.right):
            row, ok, err = n.left.Next()
            if err is not None or not ok:
                return Row(), ok, err
            n.cur = row
            n.rj = 0
            n.primed = True
        if n.rj >= len(n.right):
            continue
        right = n.right[n.rj]
        n.rj += 1
        joined = _concat(n.cur, right)
        try:
            lv = Eval(n.on_l, joined)
            rv = Eval(n.on_r, joined)
        except Exception as e:
            return Row(), False, e
        if lv.t == rv.t and _values_equal(lv, rv):
            return joined, True, None


def _concat(a: Row, b: Row) -> Row:
    return Row(cols=list(a.cols) + list(b.cols), vals=list(a.vals) + list(b.vals))


def _values_equal(a: Value, b: Value) -> bool:
    if a.t != b.t:
        return False
    if a.t == TypeInt:
        return a.i == b.i
    if a.t == TypeText:
        return a.s == b.s
    return a.b == b.b
