"""Open redirect targets (student-owned in chapter 3)."""

from __future__ import annotations

import os

from tinysh.ast.ast import Redir
from tinysh.lex.token import RedirApp, RedirErr, RedirIn, RedirOut

from .spawn import close_all


def open_redirs(directory: str, redirs: list[Redir]):
    files = []
    try:
        for r in redirs:
            files.append(open_one(directory, r))
        return files
    except Exception:
        close_all(files)
        raise


def open_one(directory: str, r: Redir):
    """open_one opens one redirect target."""
    # TODO(3.2): Resolve r.file against dir. Open with trunc/append/read per kind.
    raise NotImplementedError("TODO(3.2): open_one")
