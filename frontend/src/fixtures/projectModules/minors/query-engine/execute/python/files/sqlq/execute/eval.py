"""Eval / Truth — chapter 4 student work."""

from __future__ import annotations

from sqlq.catalog.catalog import Bool, Int, Text, TypeBool, TypeInt, TypeText, Value
from sqlq.parse.ast import Binary, Call, Ident, IntLit, Qual, StrLit


def Eval(e, row) -> Value:
    # TODO(4.2): IntLit, StrLit, Ident and Qual via row.Get, Binary for AND and = < >.
    # AND skips the right side when the left is false. Aggregate Call is an error.
    raise NotImplementedError("TODO(4.2): Eval")


def Truth(e, row) -> bool:
    v = Eval(e, row)
    if v.t != TypeBool:
        raise ValueError("WHERE must be a comparison")
    return v.b
