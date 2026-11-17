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
            # TODO(1.2)
            raise NotImplementedError("TODO(1.2)")
        elif c == "'":
            # TODO(1.1)
            raise NotImplementedError("TODO(1.1)")
        elif c == '"':
            # TODO(1.1)
            raise NotImplementedError("TODO(1.1)")
        else:
            # TODO(1.1)
            raise NotImplementedError("TODO(1.1)")
    _ = start
    _ = b
    # TODO(1.1)
    raise NotImplementedError("TODO(1.1)")


def scan_op(s) -> Token:
    """scan_op reads one operator token. The caller has already checked at_op()."""
    # TODO(1.3)
    raise NotImplementedError("TODO(1.3)")
