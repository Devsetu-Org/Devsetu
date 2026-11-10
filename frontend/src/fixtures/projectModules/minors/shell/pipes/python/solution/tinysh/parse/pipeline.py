"""Pipeline splitting (student-owned in chapter 4)."""

from __future__ import annotations

from tinysh.ast.ast import Cmd
from tinysh.lex.token import Amp, EOF, Pipe


def split_pipeline(p) -> list[Cmd]:
    """split_pipeline reads one or more commands separated by |."""
    cmds: list[Cmd] = []
    while True:
        cmd = p.cmd()
        cmds.append(cmd)
        if p.kind() != Pipe:
            break
        p.bump()
        if p.kind() in (EOF, Amp, Pipe):
            raise p.errf("missing command after |")
    return cmds
