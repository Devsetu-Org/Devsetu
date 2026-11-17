"""Wire redirect files onto stdio (student-owned in chapter 3)."""

from __future__ import annotations

from tinysh.ast.ast import Redir
from tinysh.lex.token import RedirApp, RedirErr, RedirIn, RedirOut

from .run import Stdio


def apply_redirs_io(base: Stdio, redirs: list[Redir], files) -> Stdio:
    """apply_redirs_io overlays opened redirect files onto the base stdio."""
    out = Stdio(stdin=base.stdin, stdout=base.stdout, stderr=base.stderr)
    for i, r in enumerate(redirs):
        if r.kind == RedirIn:
            out.stdin = files[i]
        elif r.kind in (RedirOut, RedirApp):
            out.stdout = files[i]
        elif r.kind == RedirErr:
            out.stderr = files[i]
    return out
