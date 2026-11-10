"""Redirect parsing (student-owned in chapter 3)."""

from __future__ import annotations

from tinysh.ast.ast import Redir
from tinysh.lex.token import Word


def parse_redir(p) -> Redir:
    """parse_redir reads a redirect operator and the filename word that follows."""
    # TODO(3.1): Record kind from the current token, bump, require a Word, return Redir.
    raise NotImplementedError("TODO(3.1): parse_redir")
