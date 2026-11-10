"""Create / Insert — chapter 3 student work."""

from __future__ import annotations

from typing import List

from sqlq.catalog.catalog import Col, Table, TypeText, Value


def Create(db, name: str, cols: List[Col]) -> None:
    # TODO(3.2): Reject an empty name, an empty column list, a duplicate table, or a duplicate column.
    # Store a copy of cols on a new Table.
    raise NotImplementedError("TODO(3.2): Create")


def Insert(db, name: str, row: List[Value]) -> None:
    # TODO(3.3): Lookup the table. Reject a width mismatch or a cell whose T is not the column's Type.
    # Append a copy of the row.
    raise NotImplementedError("TODO(3.3): Insert")
