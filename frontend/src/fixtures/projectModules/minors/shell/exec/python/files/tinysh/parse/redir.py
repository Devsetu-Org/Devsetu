"""Redirect parsing — stubs until the redirects chapter."""

from __future__ import annotations

from tinysh.ast.ast import Redir


def parse_redir(p) -> Redir:
    raise p.errf("redirects not supported yet")
