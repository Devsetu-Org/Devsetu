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
    # TODO(1.1): From s.i, read while is_ident_part(s.peek()) using bump.
    # Return Token(kind=keyword(lit), lit=lit, pos=start). lit keeps the original case.
    raise NotImplementedError("TODO(1.1): scan_ident")


def scan_number(s) -> Token:
    """Read a run of digits. The caller has already seen a digit."""
    # TODO(1.2): Read while is_digit(s.peek()). Return Token(kind=Int, lit=lit, pos=start).
    raise NotImplementedError("TODO(1.2): scan_number")


def scan_string(s) -> Token:
    """Read a single-quoted string. The caller has already seen the opening quote."""
    # TODO(1.2): Skip the opening quote. Append chars until the closing quote.
    # A doubled quote ('') is one quote in the literal. Newline or EOF raises
    # LexError(start, "unterminated string"). kind is String, lit is the decoded text.
    raise NotImplementedError("TODO(1.2): scan_string")


def scan_symbol(s) -> Token:
    """Read one punctuation character."""
    # TODO(1.3): Map * , ( ) = < > ; . to Star, Comma, LParen, RParen, Eq, Lt, Gt, Semicolon, Dot.
    # Anything else is LexError(pos, "unexpected character").
    raise NotImplementedError("TODO(1.3): scan_symbol")
