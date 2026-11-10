"""Pipeline splitting (student-owned in chapter 4)."""

from __future__ import annotations

from tinysh.ast.ast import Cmd
from tinysh.lex.token import Amp, EOF, Pipe


def split_pipeline(p) -> list[Cmd]:
    """split_pipeline reads one or more commands separated by |."""
    cmd = p.cmd()
    cmds = [cmd]
    if p.kind() != Pipe:
        return cmds
    # TODO(4.1): While the next token is Pipe, bump it and parse another cmd.
    # A trailing Pipe with no following command is an error.
    raise NotImplementedError("TODO(4.1): split_pipeline")
