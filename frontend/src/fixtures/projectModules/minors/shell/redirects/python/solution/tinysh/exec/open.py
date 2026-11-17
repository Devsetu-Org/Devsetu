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
    path = r.file
    if not os.path.isabs(path):
        path = os.path.join(directory, path)
    if r.kind == RedirOut:
        return open(path, "w", buffering=1)
    if r.kind == RedirApp:
        return open(path, "a", buffering=1)
    if r.kind == RedirIn:
        return open(path, "r", buffering=1)
    if r.kind == RedirErr:
        return open(path, "w", buffering=1)
    raise OSError(f"unknown redirect {r.kind}")
