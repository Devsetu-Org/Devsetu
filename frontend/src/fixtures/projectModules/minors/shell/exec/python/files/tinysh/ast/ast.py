"""AST shapes for tinysh statements."""

from __future__ import annotations

from dataclasses import dataclass, field

from tinysh.lex.token import Kind


@dataclass
class Redir:
    kind: Kind
    file: str


@dataclass
class Cmd:
    argv: list[str] = field(default_factory=list)
    redirs: list[Redir] = field(default_factory=list)


@dataclass
class Pipeline:
    cmds: list[Cmd] = field(default_factory=list)
    background: bool = False
