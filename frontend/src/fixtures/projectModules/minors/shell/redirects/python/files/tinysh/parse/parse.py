"""Parse tokens into a pipeline."""

from __future__ import annotations

from tinysh.ast.ast import Cmd, Pipeline, Redir
from tinysh.lex.token import (
    Amp,
    EOF,
    Pipe,
    RedirApp,
    RedirErr,
    RedirIn,
    RedirOut,
    Token,
    Word,
    kind_name,
)

from . import bg, pipeline, redir


class Error(Exception):
    def __init__(self, pos: int, msg: str):
        super().__init__(msg)
        self.pos = pos
        self.msg = msg


class Parser:
    def __init__(self, toks: list[Token]):
        self.toks = toks
        self.i = 0

    def kind(self):
        if self.i >= len(self.toks):
            return EOF
        return self.toks[self.i].kind

    def bump(self) -> Token:
        t = self.toks[self.i]
        self.i += 1
        return t

    def errf(self, msg: str) -> Error:
        pos = 0
        if self.i < len(self.toks):
            pos = self.toks[self.i].pos
        return Error(pos, msg)

    def pipeline(self) -> Pipeline:
        cmds = pipeline.split_pipeline(self)
        background = bg.take_background(self)
        return Pipeline(cmds=cmds, background=background)

    def cmd(self) -> Cmd:
        c = Cmd()
        while True:
            k = self.kind()
            if k == Word:
                c.argv.append(self.bump().lit)
            elif k in (RedirOut, RedirApp, RedirIn, RedirErr):
                c.redirs.append(redir.parse_redir(self))
            else:
                if not c.argv and not c.redirs:
                    raise self.errf("expected command")
                return c


def Parse(toks: list[Token]) -> Pipeline:
    p = Parser(toks)
    pl = p.pipeline()
    if p.kind() != EOF:
        raise p.errf(f"unexpected token {kind_name(p.kind())}")
    return pl
