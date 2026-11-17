"""Expression parsing — chapter 2 student work."""

from __future__ import annotations

from sqlq.lex import token as T
from sqlq.parse.ast import Binary, Call, Ident, IntLit, Qual, StrLit
from sqlq.parse.ints import parse_int


def parse_expr(p):
    return parse_and(p)


def parse_and(p):
    left = parse_cmp(p)
    while p.eat(T.KwAnd):
        right = parse_cmp(p)
        left = Binary(op="AND", left=left, right=right)
    return left


def parse_cmp(p):
    left = parse_primary(p)
    if p.eat(T.Eq):
        op = "="
    elif p.eat(T.Lt):
        op = "<"
    elif p.eat(T.Gt):
        op = ">"
    else:
        return left
    right = parse_primary(p)
    return Binary(op=op, left=left, right=right)


def parse_primary(p):
    if p.at(T.Int):
        t = p.expect(T.Int)
        try:
            n = parse_int(t.lit)
        except ValueError:
            raise p.errorf("bad integer")
        return IntLit(v=n)
    if p.at(T.String):
        t = p.expect(T.String)
        return StrLit(v=t.lit)
    if p.at(T.KwCount):
        return parse_call(p, "count", True)
    if p.at(T.KwSum):
        return parse_call(p, "sum", False)
    if p.at(T.Ident):
        t = p.expect(T.Ident)
        if p.eat(T.Dot):
            col = p.expect(T.Ident)
            return Qual(table=t.lit, name=col.lit)
        return Ident(name=t.lit)
    if p.eat(T.LParen):
        e = parse_expr(p)
        p.expect(T.RParen)
        return e
    raise p.errorf("expected an expression")


def parse_call(p, name: str, allow_star: bool):
    if name == "count":
        p.eat(T.KwCount)
    else:
        p.eat(T.KwSum)
    p.expect(T.LParen)
    if allow_star and p.eat(T.Star):
        p.expect(T.RParen)
        return Call(name=name, star=True)
    arg = parse_expr(p)
    p.expect(T.RParen)
    return Call(name=name, arg=arg)
