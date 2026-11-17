"""Word and operator scanning (student-owned in chapter 1)."""

from __future__ import annotations

from .chars import op_start
from .token import (
    Amp,
    Error,
    Pipe,
    RedirApp,
    RedirErr,
    RedirIn,
    RedirOut,
    Token,
    Word,
)


def scan_word(s) -> Token:
    """scan_word reads one word. The caller has already skipped space and checked not at_op.
    Unquoted text ends at whitespace or an operator. Single quotes keep every
    byte until the closing quote. Double quotes allow backslash escapes.
    Outside quotes, a backslash escapes the next byte.
    """
    start = s.i
    b: list[str] = []
    while not s.eof():
        c = s.peek()
        if c in " \t\n\r":
            break
        if op_start(c, s.peek_at(1)):
            break
        if c == "\\":
            s.bump()
            if s.eof():
                raise Error(start, "trailing backslash")
            b.append(s.bump())
        elif c == "'":
            s.bump()
            while True:
                if s.eof():
                    raise Error(start, "unterminated single quote")
                q = s.bump()
                if q == "'":
                    break
                b.append(q)
        elif c == '"':
            s.bump()
            while True:
                if s.eof():
                    raise Error(start, "unterminated double quote")
                q = s.bump()
                if q == '"':
                    break
                if q == "\\":
                    if s.eof():
                        raise Error(start, "trailing backslash")
                    b.append(s.bump())
                    continue
                b.append(q)
        else:
            b.append(s.bump())
    if len(b) == 0 and s.i == start:
        raise Error(start, "empty word")
    return Token(kind=Word, lit="".join(b), pos=start)


def scan_op(s) -> Token:
    """scan_op reads one operator token. The caller has already checked at_op()."""
    pos = s.i
    c = s.bump()
    if c == "|":
        return Token(kind=Pipe, lit="|", pos=pos)
    if c == "<":
        return Token(kind=RedirIn, lit="<", pos=pos)
    if c == "&":
        return Token(kind=Amp, lit="&", pos=pos)
    if c == ">":
        if not s.eof() and s.peek() == ">":
            s.bump()
            return Token(kind=RedirApp, lit=">>", pos=pos)
        return Token(kind=RedirOut, lit=">", pos=pos)
    if c == "2":
        if s.eof() or s.peek() != ">":
            raise Error(pos, "expected 2>")
        s.bump()
        return Token(kind=RedirErr, lit="2>", pos=pos)
    raise Error(pos, "unexpected operator")
