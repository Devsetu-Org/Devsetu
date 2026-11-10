"""Pipeline splitting — single command until the pipes chapter."""

from __future__ import annotations

from tinysh.ast.ast import Cmd
from tinysh.lex.token import Pipe


def split_pipeline(p) -> list[Cmd]:
    if p.kind() == Pipe:
        raise p.errf("pipelines not supported yet")
    cmd = p.cmd()
    if p.kind() == Pipe:
        raise p.errf("pipelines not supported yet")
    return [cmd]
