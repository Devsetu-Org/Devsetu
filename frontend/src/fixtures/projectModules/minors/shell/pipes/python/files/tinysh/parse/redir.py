"""Redirect parsing (student-owned in chapter 3)."""

from __future__ import annotations

from tinysh.ast.ast import Redir
from tinysh.lex.token import Word


def parse_redir(p) -> Redir:
    """parse_redir reads a redirect operator and the filename word that follows."""
    k = p.kind()
    p.bump()
    if p.kind() != Word:
        raise p.errf("expected filename after redirect")
    return Redir(kind=k, file=p.bump().lit)
