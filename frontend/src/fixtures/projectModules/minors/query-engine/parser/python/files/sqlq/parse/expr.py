"""Expression parsing — chapter 2 student work."""

from __future__ import annotations

from sqlq.lex import token as T
from sqlq.parse.ast import Binary, Call, Ident, IntLit, Qual, StrLit
from sqlq.parse.ints import parse_int


def parse_expr(p):
    return parse_and(p)


def parse_and(p):
    # TODO(2.1): parse_cmp, then while the next token is AND, parse another comparison
    # and wrap the two in Binary(op="AND", left=left, right=right).
    raise NotImplementedError("TODO(2.1): parse_and")


def parse_cmp(p):
    # TODO(2.1): parse_primary. If the next token is =, <, or >, consume it, parse another
    # primary, and return Binary(op="=", "<", or ">", left=left, right=right). Otherwise return the primary.
    raise NotImplementedError("TODO(2.1): parse_cmp")


def parse_primary(p):
    # TODO(2.2): Int -> IntLit (parse_int). String -> StrLit. COUNT/SUM -> parse_call.
    # Ident, then an optional . Ident, -> Qual or Ident. '(' expr ')' returns the inner expr.
    # Anything else is p.errorf("expected an expression").
    raise NotImplementedError("TODO(2.2): parse_primary")


def parse_call(p, name: str, allow_star: bool):
    # TODO(2.2): Consume the keyword, '(', then either '*' (only when allow_star) or an expression, then ')'.
    # Return Call(name=name, star=True) or Call(name=name, arg=arg).
    raise NotImplementedError("TODO(2.2): parse_call")
