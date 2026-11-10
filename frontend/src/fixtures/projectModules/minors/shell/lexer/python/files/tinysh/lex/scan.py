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
            # TODO(1.2): bump past the backslash; on EOF raise trailing-backslash;
            # otherwise append the next bumped byte to b and continue.
            raise NotImplementedError("TODO(1.2): backslash escape")
        elif c == "'":
            # TODO(1.1): bump past opening quote; append bytes until closing quote;
            # EOF raises unterminated single quote.
            raise NotImplementedError("TODO(1.1): single-quoted word")
        elif c == '"':
            # TODO(1.1): bump past opening quote; append bytes until closing quote.
            # Inside, a backslash escapes the next byte (TODO 1.2 shares this path).
            # EOF raises unterminated double quote.
            raise NotImplementedError("TODO(1.1): double-quoted word")
        else:
            # TODO(1.1): append bump() to b.
            raise NotImplementedError("TODO(1.1): unquoted character")
    _ = start
    _ = b
    raise NotImplementedError("TODO(1.1): return Word token")


def scan_op(s) -> Token:
    """scan_op reads one operator token. The caller has already checked at_op()."""
    # TODO(1.3): Map | < & > >> and 2> to Pipe, RedirIn, Amp, RedirOut, RedirApp, RedirErr.
    raise NotImplementedError("TODO(1.3): scan_op")
