"""JOIN / GROUP BY / ORDER BY / LIMIT — chapter 5 student work."""

from __future__ import annotations

from sqlq.lex import token as T
from sqlq.parse.ast import Join, OrderKey
from sqlq.parse.expr import parse_expr, parse_primary
from sqlq.parse.ints import parse_int
from sqlq.parse.select import parse_alias


def parse_tail(p, s) -> None:
    if p.eat(T.KwGroup):
        p.expect(T.KwBy)
        while True:
            s.group.append(parse_expr(p))
            if not p.eat(T.Comma):
                break
    if p.eat(T.KwOrder):
        p.expect(T.KwBy)
        while True:
            e = parse_expr(p)
            key = OrderKey(expr=e)
            if p.eat(T.KwDesc):
                key.desc = True
            else:
                p.eat(T.KwAsc)
            s.order.append(key)
            if not p.eat(T.Comma):
                break
    if p.eat(T.KwLimit):
        t = p.expect(T.Int)
        try:
            n = parse_int(t.lit)
        except ValueError:
            raise p.errorf("bad limit")
        s.limit = n


def parse_join(p) -> Join:
    p.eat(T.KwInner)
    p.expect(T.KwJoin)
    name = p.expect(T.Ident)
    j = Join(table=name.lit, alias=parse_alias(p))
    p.expect(T.KwOn)
    left = parse_primary(p)
    p.expect(T.Eq)
    right = parse_primary(p)
    j.left, j.right = left, right
    return j
