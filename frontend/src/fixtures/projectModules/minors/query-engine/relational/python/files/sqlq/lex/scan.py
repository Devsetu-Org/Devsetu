"""The four scan methods — chapter 1 student work."""

from __future__ import annotations

from sqlq.lex.chars import is_digit, is_ident_part
from sqlq.lex.token import (
    Comma,
    Dot,
    Eq,
    Gt,
    Int,
    LParen,
    LexError,
    Lt,
    RParen,
    Semicolon,
    Star,
    String,
    Token,
    keyword,
)


def scan_ident(s) -> Token:
    """Read an identifier or keyword. The caller has already seen a letter or '_'."""
    start = s.i
    while not s.eof() and is_ident_part(s.peek()):
        s.bump()
    lit = s.src[start : s.i]
    return Token(kind=keyword(lit), lit=lit, pos=start)


def scan_number(s) -> Token:
    """Read a run of digits. The caller has already seen a digit."""
    start = s.i
    while not s.eof() and is_digit(s.peek()):
        s.bump()
    return Token(kind=Int, lit=s.src[start : s.i], pos=start)


def scan_string(s) -> Token:
    """Read a single-quoted string. The caller has already seen the opening quote."""
    start = s.i
    s.bump()
    b: list[str] = []
    while not s.eof():
        c = s.bump()
        if c == "\n":
            raise LexError(start, "unterminated string")
        if c == "'":
            if not s.eof() and s.peek() == "'":
                s.bump()
                b.append("'")
                continue
            return Token(kind=String, lit="".join(b), pos=start)
        b.append(c)
    raise LexError(start, "unterminated string")


def scan_symbol(s) -> Token:
    """Read one punctuation character."""
    pos = s.i
    c = s.bump()
    mapping = {
        "*": Star,
        ",": Comma,
        "(": LParen,
        ")": RParen,
        "=": Eq,
        "<": Lt,
        ">": Gt,
        ";": Semicolon,
        ".": Dot,
    }
    k = mapping.get(c)
    if k is None:
        raise LexError(pos, "unexpected character")
    return Token(kind=k, lit=c, pos=pos)
