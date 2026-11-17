"""Create / Insert — chapter 3 student work."""

from __future__ import annotations

from typing import List

from sqlq.catalog.catalog import Col, Table, TypeText, Value


def Create(db, name: str, cols: List[Col]) -> None:
    # TODO(3.2) — Create
    raise NotImplementedError("TODO(3.2)")


def Insert(db, name: str, row: List[Value]) -> None:
    # TODO(3.3) — Insert
    raise NotImplementedError("TODO(3.3)")
