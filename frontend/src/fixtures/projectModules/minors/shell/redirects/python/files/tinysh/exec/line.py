"""Run one shell line."""

from __future__ import annotations

from tinysh.lex import Scan
from tinysh.lex.token import Error as LexError
from tinysh.parse import Parse
from tinysh.parse.parse import Error as ParseError

from . import pipe


def run_line(s, line: str) -> int:
    line = line.strip()
    if not line or line.startswith("#"):
        return 0
    try:
        toks = Scan(line)
    except LexError as e:
        s.printf_err("lex: %s\n", str(e))
        return 2
    try:
        pl = Parse(toks)
    except ParseError as e:
        s.printf_err("parse: %s\n", str(e))
        return 2
    return pipe.run_pipeline(s, pl)


# Bind as method
from .shell import Shell  # noqa: E402

Shell.run_line = run_line  # type: ignore[attr-defined]
