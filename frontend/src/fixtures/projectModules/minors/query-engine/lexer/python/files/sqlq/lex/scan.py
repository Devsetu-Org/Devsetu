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
    # TODO(1.1) — scan_ident
    raise NotImplementedError("TODO(1.1)")


def scan_number(s) -> Token:
    """Read a run of digits. The caller has already seen a digit."""
    # TODO(1.2) — scan_number
    raise NotImplementedError("TODO(1.2)")


def scan_string(s) -> Token:
    """Read a single-quoted string. The caller has already seen the opening quote."""
    # TODO(1.2) — scan_string
    raise NotImplementedError("TODO(1.2)")


def scan_symbol(s) -> Token:
    """Read one punctuation character."""
    # TODO(1.3) — scan_symbol
    raise NotImplementedError("TODO(1.3)")
