"""Rows and iterators."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable, List, Optional, Tuple

from sqlq.catalog.catalog import Table, Value


@dataclass
class Row:
    cols: List[str] = field(default_factory=list)
    vals: List[Value] = field(default_factory=list)

    def Get(self, name: str) -> Tuple[Value, bool]:
        for i, c in enumerate(self.cols):
            if c == name:
                return self.vals[i], True
        found = -1
        for i, c in enumerate(self.cols):
            dot = c.rfind(".")
            if dot >= 0 and c[dot + 1 :] == name:
                if found >= 0:
                    return Value(t=0), False
                found = i
        if found < 0:
            return Value(t=0), False
        return self.vals[found], True


class Iter:
    def Next(self):
        raise NotImplementedError


def ReadAll(it: Iter) -> List[Row]:
    out: List[Row] = []
    while True:
        row, ok, err = it.Next()
        if err is not None:
            raise err
        if not ok:
            return out
        out.append(row)


@dataclass
class Scan:
    cols: List[str]
    rows: List[List[Value]]
    i: int = 0

    def Next(self):
        from sqlq.execute.scan import scan_next
        return scan_next(self)


def NewScan(t: Table, qualifier: str) -> Scan:
    cols = [f"{qualifier}.{c.name}" for c in t.cols]
    rows = [list(r) for r in t.rows]
    return Scan(cols=cols, rows=rows)


@dataclass
class Filter:
    child: Iter
    pred: Callable

    def Next(self):
        from sqlq.execute.filter import filter_next
        return filter_next(self)


@dataclass
class Project:
    child: Iter
    pick: Callable
    names: Optional[List[str]] = None

    def Next(self):
        from sqlq.execute.project import project_next
        return project_next(self)
