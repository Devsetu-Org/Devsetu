"""SortRows / LimitRows — chapter 5 student work."""

from __future__ import annotations

from typing import List

from sqlq.catalog.catalog import TypeInt, TypeText
from sqlq.execute.row import Row
from sqlq.parse.ast import Ident, Name, OrderKey


def SortRows(rows: List[Row], keys: List[OrderKey]) -> None:
    idx = []
    desc = []
    for k in keys:
        name = Name(k.expr)
        if isinstance(k.expr, Ident):
            name = k.expr.name
        found = -1
        if rows:
            for c, col in enumerate(rows[0].cols):
                if col == name or col == Name(k.expr):
                    found = c
                    break
        if found < 0 and rows:
            raise ValueError(f"ORDER BY {name} is not an output column")
        idx.append(found)
        desc.append(k.desc)

    def key_fn(row: Row):
        parts = []
        for i, col_i in enumerate(idx):
            if col_i < 0:
                parts.append((0, 0))
                continue
            v = row.vals[col_i]
            if v.t == TypeInt:
                parts.append((0, -v.i if desc[i] else v.i))
            elif v.t == TypeText:
                # For desc text, we can't negate; use a wrapper via sort with cmp
                parts.append((1, v.s))
            else:
                parts.append((2, v.b))
        return parts

    # Stable sort with proper desc for text via multi-pass
    for i in range(len(idx) - 1, -1, -1):
        if idx[i] < 0:
            continue
        col_i = idx[i]
        d = desc[i]

        def make_key(ci, descending):
            def k(row: Row):
                v = row.vals[ci]
                if v.t == TypeInt:
                    return v.i
                if v.t == TypeText:
                    return v.s
                return v.b
            return k

        rows.sort(key=make_key(col_i, d), reverse=d)


def LimitRows(rows: List[Row], n: int) -> List[Row]:
    if n < 0 or n >= len(rows):
        return rows
    return rows[:n]
