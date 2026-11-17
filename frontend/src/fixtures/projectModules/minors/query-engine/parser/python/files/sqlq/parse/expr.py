"""Expression parsing — chapter 2 student work."""

from __future__ import annotations

from sqlq.lex import token as T
from sqlq.parse.ast import Binary, Call, Ident, IntLit, Qual, StrLit
from sqlq.parse.ints import parse_int


def parse_expr(p):
    return parse_and(p)


def parse_and(p):
    # TODO(2.1) — parse_and
    raise NotImplementedError("TODO(2.1)")


def parse_cmp(p):
    # TODO(2.1) — parse_cmp
    raise NotImplementedError("TODO(2.1)")


def parse_primary(p):
    # TODO(2.2) — parse_primary
    raise NotImplementedError("TODO(2.2)")


def parse_call(p, name: str, allow_star: bool):
    # TODO(2.2) — parse_call
    raise NotImplementedError("TODO(2.2)")
