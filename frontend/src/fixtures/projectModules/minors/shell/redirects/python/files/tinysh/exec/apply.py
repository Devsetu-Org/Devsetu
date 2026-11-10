"""Wire redirect files onto stdio (student-owned in chapter 3)."""

from __future__ import annotations

from tinysh.ast.ast import Redir
from tinysh.lex.token import RedirApp, RedirErr, RedirIn, RedirOut

from .run import Stdio


def apply_redirs_io(base: Stdio, redirs: list[Redir], files) -> Stdio:
    """apply_redirs_io overlays opened redirect files onto the base stdio."""
    # TODO(3.3): For each redir, assign files[i] onto stdin, stdout, or stderr by kind.
    raise NotImplementedError("TODO(3.3): apply_redirs_io")
