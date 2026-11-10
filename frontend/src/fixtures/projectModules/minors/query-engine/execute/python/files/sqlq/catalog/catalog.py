"""In-memory catalog of tables."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import IntEnum
from typing import Dict, List, Optional


class Type(IntEnum):
    INT = 0
    TEXT = 1
    BOOL = 2


TypeInt = Type.INT
TypeText = Type.TEXT
TypeBool = Type.BOOL


@dataclass
class Value:
    t: Type
    i: int = 0
    s: str = ""
    b: bool = False

    def __str__(self) -> str:
        if self.t == TypeInt:
            return str(self.i)
        if self.t == TypeText:
            return self.s
        if self.t == TypeBool:
            return "true" if self.b else "false"
        return ""


def Int(n: int) -> Value:
    return Value(t=TypeInt, i=n)


def Text(s: str) -> Value:
    return Value(t=TypeText, s=s)


def Bool(b: bool) -> Value:
    return Value(t=TypeBool, b=b)


@dataclass
class Col:
    name: str
    type: Type


@dataclass
class Table:
    name: str
    cols: List[Col] = field(default_factory=list)
    rows: List[List[Value]] = field(default_factory=list)


class DB:
    def __init__(self):
        self.tables: Dict[str, Table] = {}

    def Lookup(self, name: str) -> Table:
        t = self.tables.get(name)
        if t is None:
            raise ValueError(f"no such table {name}")
        return t

    def Create(self, name: str, cols: List[Col]) -> None:
        from sqlq.catalog.mutate import Create as _Create
        return _Create(self, name, cols)

    def Insert(self, name: str, row: List[Value]) -> None:
        from sqlq.catalog.mutate import Insert as _Insert
        return _Insert(self, name, row)


def New() -> DB:
    return DB()
