"""Public facade: Open, Exec, Query."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional

from sqlq.catalog.catalog import DB as CatDB
from sqlq.catalog.catalog import Int, New, Text, TypeText, Value
from sqlq.execute.build import RunSelect
from sqlq.parse.ast import CreateTable, Insert, IntLit, Select, StrLit, TypeText as PTypeText
from sqlq.parse.parser import Parse


@dataclass
class Result:
    cols: List[str] = field(default_factory=list)
    rows: List[List[Value]] = field(default_factory=list)


class DB:
    def __init__(self):
        self.cat: CatDB = New()

    def Exec(self, sql: str) -> None:
        stmt = Parse(sql)
        if isinstance(stmt, CreateTable):
            from sqlq.catalog.catalog import Col, TypeInt as CInt, TypeText as CText
            cols = []
            for c in stmt.cols:
                typ = CText if c.type == PTypeText else CInt
                cols.append(Col(name=c.name, type=typ))
            self.cat.Create(stmt.name, cols)
            return
        if isinstance(stmt, Insert):
            for row in stmt.rows:
                vals = [_literal(e) for e in row]
                self.cat.Insert(stmt.table, vals)
            return
        raise ValueError("EXEC does not run SELECT")

    def Query(self, sql: str) -> Result:
        stmt = Parse(sql)
        if not isinstance(stmt, Select):
            raise ValueError("QUERY runs SELECT")
        rows = RunSelect(self.cat, stmt)
        res = Result()
        if rows:
            res.cols = list(rows[0].cols)
        for row in rows:
            res.rows.append(list(row.vals))
        return res


def Open() -> DB:
    return DB()


def _literal(e) -> Value:
    if isinstance(e, IntLit):
        return Int(e.v)
    if isinstance(e, StrLit):
        return Text(e.v)
    raise ValueError("INSERT values must be literals")


def Format(res: Result) -> str:
    lines = ["\t".join(res.cols)]
    for row in res.rows:
        lines.append("\t".join(str(v) for v in row))
    return "\n".join(lines) if res.rows else "\t".join(res.cols)
