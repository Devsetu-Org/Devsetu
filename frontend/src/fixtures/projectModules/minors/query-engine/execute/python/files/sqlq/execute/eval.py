"""Eval / Truth — chapter 4 student work."""

from __future__ import annotations

from sqlq.catalog.catalog import Bool, Int, Text, TypeBool, TypeInt, TypeText, Value
from sqlq.parse.ast import Binary, Call, Ident, IntLit, Qual, StrLit


def Eval(e, row) -> Value:
    # TODO(4.2) — Eval
    raise NotImplementedError("TODO(4.2)")


def Truth(e, row) -> bool:
    v = Eval(e, row)
    if v.t != TypeBool:
        raise ValueError("WHERE must be a comparison")
    return v.b
