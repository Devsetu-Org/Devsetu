"""Nested-loop join — chapter 5 student work."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List

from sqlq.catalog.catalog import TypeInt, TypeText, Value
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
    # TODO(5.2): For each left row, try every right row. Concatenate the columns.
    # Keep the pair when Eval(on_l) and Eval(on_r) have the same type and the same value.
    raise NotImplementedError("TODO(5.2): NestedLoop.Next")
