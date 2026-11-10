"""Recursive-descent cursor over tokens."""

from __future__ import annotations

from sqlq.lex import Scan, Token
from sqlq.lex import token as T
from sqlq.parse.ast import Stmt
from sqlq.parse.select import parse_select


class ParseError(Exception):
    pass


class Parser:
    def __init__(self, toks: list):
        self.toks = toks
        self.i = 0

    def peek(self) -> Token:
        return self.toks[self.i]

    def at(self, k) -> bool:
        return self.peek().kind == k

    def eat(self, k) -> bool:
        if not self.at(k):
            return False
        self.i += 1
        return True

    def expect(self, k) -> Token:
        t = self.peek()
        if t.kind != k:
            raise self.errorf("expected %s", k)
        self.i += 1
        return t

    def errorf(self, fmt: str, *args) -> ParseError:
        return ParseError(("at %d: " + fmt) % ((self.peek().pos,) + args))

    def parse_stmt(self) -> Stmt:
        if self.at(T.KwSelect):
            return parse_select(self)
        raise self.errorf("expected SELECT")

    def parse_from_tail(self, s) -> None:
        return None

    def finish_select(self, s) -> None:
        return None


def Parse(src: str) -> Stmt:
    toks = Scan(src)
    p = Parser(toks)
    stmt = p.parse_stmt()
    p.eat(T.Semicolon)
    if not p.at(T.EOF):
        raise p.errorf("unexpected token %s", p.peek().kind)
    return stmt
