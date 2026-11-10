"""Eval / Truth — chapter 4 student work."""

from __future__ import annotations

from sqlq.catalog.catalog import Bool, Int, Text, TypeBool, TypeInt, TypeText, Value
from sqlq.parse.ast import Binary, Call, Ident, IntLit, Qual, StrLit


def Eval(e, row) -> Value:
    if isinstance(e, IntLit):
        return Int(e.v)
    if isinstance(e, StrLit):
        return Text(e.v)
    if isinstance(e, Ident):
        val, ok = row.Get(e.name)
        if not ok:
            raise ValueError(f"no column {e.name}")
        return val
    if isinstance(e, Qual):
        val, ok = row.Get(e.table + "." + e.name)
        if not ok:
            val, ok = row.Get(e.name)
        if not ok:
            raise ValueError(f"no column {e.table}.{e.name}")
        return val
    if isinstance(e, Binary):
        return _eval_binary(e, row)
    if isinstance(e, Call):
        raise ValueError(f"aggregate {e.name} is not allowed here")
    raise ValueError("bad expression")


def _eval_binary(v: Binary, row) -> Value:
    left = Eval(v.left, row)
    if v.op == "AND":
        if left.t != TypeBool:
            raise ValueError("AND needs booleans")
        if not left.b:
            return Bool(False)
        right = Eval(v.right, row)
        if right.t != TypeBool:
            raise ValueError("AND needs booleans")
        return Bool(right.b)
    right = Eval(v.right, row)
    if left.t != right.t or (left.t != TypeInt and left.t != TypeText):
        raise ValueError("cannot compare those types")
    cmp = 0
    if left.t == TypeInt:
        if left.i < right.i:
            cmp = -1
        elif left.i > right.i:
            cmp = 1
    else:
        if left.s < right.s:
            cmp = -1
        elif left.s > right.s:
            cmp = 1
    if v.op == "=":
        ok = cmp == 0
    elif v.op == "<":
        ok = cmp < 0
    elif v.op == ">":
        ok = cmp > 0
    else:
        raise ValueError(f"bad operator {v.op}")
    return Bool(ok)


def Truth(e, row) -> bool:
    v = Eval(e, row)
    if v.t != TypeBool:
        raise ValueError("WHERE must be a comparison")
    return v.b
