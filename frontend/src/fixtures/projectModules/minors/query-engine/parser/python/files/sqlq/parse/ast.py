"""AST node types for sqlq statements and expressions."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import IntEnum
from typing import List, Optional, Union


class TypeName(IntEnum):
    INT = 0
    TEXT = 1

    def __str__(self) -> str:
        return "TEXT" if self == TypeName.TEXT else "INT"


TypeInt = TypeName.INT
TypeText = TypeName.TEXT


@dataclass
class Column:
    name: str
    type: TypeName


@dataclass
class CreateTable:
    name: str
    cols: List[Column] = field(default_factory=list)


@dataclass
class Insert:
    table: str
    rows: List[List["Expr"]] = field(default_factory=list)


@dataclass
class Join:
    table: str
    alias: str = ""
    left: Optional["Expr"] = None
    right: Optional["Expr"] = None


@dataclass
class SelectItem:
    expr: Optional["Expr"] = None
    alias: str = ""
    star: bool = False


@dataclass
class OrderKey:
    expr: "Expr"
    desc: bool = False


@dataclass
class Select:
    items: List[SelectItem] = field(default_factory=list)
    from_table: str = ""
    alias: str = ""
    where: Optional["Expr"] = None
    join: Optional[Join] = None
    group: List["Expr"] = field(default_factory=list)
    order: List[OrderKey] = field(default_factory=list)
    limit: Optional[int] = None


@dataclass
class Ident:
    name: str


@dataclass
class Qual:
    table: str
    name: str


@dataclass
class IntLit:
    v: int


@dataclass
class StrLit:
    v: str


@dataclass
class Binary:
    op: str
    left: "Expr"
    right: "Expr"


@dataclass
class Call:
    name: str
    arg: Optional["Expr"] = None
    star: bool = False


Expr = Union[Ident, Qual, IntLit, StrLit, Binary, Call]
Stmt = Union[CreateTable, Insert, Select]


def Name(e: Expr) -> str:
    if isinstance(e, Ident):
        return e.name
    if isinstance(e, Qual):
        return f"{e.table}.{e.name}"
    if isinstance(e, IntLit):
        return str(e.v)
    if isinstance(e, StrLit):
        return "'" + e.v + "'"
    if isinstance(e, Call):
        if e.star:
            return "count(*)"
        return f"{e.name}({Name(e.arg)})"
    if isinstance(e, Binary):
        return f"{Name(e.left)} {e.op} {Name(e.right)}"
    return "?"
