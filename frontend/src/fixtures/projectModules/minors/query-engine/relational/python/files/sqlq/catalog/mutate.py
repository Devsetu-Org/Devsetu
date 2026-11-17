"""Create / Insert — chapter 3 student work."""

from __future__ import annotations

from typing import List

from sqlq.catalog.catalog import Col, Table, TypeText, Value


def Create(db, name: str, cols: List[Col]) -> None:
    if name == "":
        raise ValueError("empty table name")
    if len(cols) == 0:
        raise ValueError(f"table {name} has no columns")
    if name in db.tables:
        raise ValueError(f"table {name} already exists")
    seen = set()
    for c in cols:
        if c.name == "" or c.name in seen:
            raise ValueError(f'bad column "{c.name}"')
        seen.add(c.name)
    db.tables[name] = Table(name=name, cols=list(cols))


def Insert(db, name: str, row: List[Value]) -> None:
    t = db.Lookup(name)
    if len(row) != len(t.cols):
        raise ValueError(f"table {name} wants {len(t.cols)} values")
    for i, c in enumerate(t.cols):
        if row[i].t != c.type:
            raise ValueError(f"column {c.name} wants {_type_name(c.type)}")
    t.rows.append(list(row))


def _type_name(t) -> str:
    return "TEXT" if t == TypeText else "INT"
