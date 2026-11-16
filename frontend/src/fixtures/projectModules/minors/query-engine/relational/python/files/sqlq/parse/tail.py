"""JOIN / GROUP BY / ORDER BY / LIMIT — chapter 5 student work."""

from __future__ import annotations

from sqlq.lex import token as T
from sqlq.parse.ast import Join, OrderKey
from sqlq.parse.expr import parse_expr, parse_primary
from sqlq.parse.ints import parse_int
from sqlq.parse.select import parse_alias


def parse_tail(p, s) -> None:
    if p.at(T.KwGroup) or p.at(T.KwOrder) or p.at(T.KwLimit):
        # TODO(5.1) — parse_tail
        raise NotImplementedError("TODO(5.1)")


def parse_join(p) -> Join:
    # TODO(5.1) — parse_join
    raise NotImplementedError("TODO(5.1)")
