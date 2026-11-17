"""Token kinds for tinysh."""

from __future__ import annotations

from dataclasses import dataclass

Illegal = 0
EOF = 1
Word = 2
Pipe = 3
RedirOut = 4
RedirApp = 5
RedirIn = 6
RedirErr = 7
Amp = 8

Kind = int

_KIND_NAMES = [
    "illegal",
    "eof",
    "word",
    "pipe",
    "redir_out",
    "redir_app",
    "redir_in",
    "redir_err",
    "amp",
]


def kind_name(k: Kind) -> str:
    if 0 <= k < len(_KIND_NAMES):
        return _KIND_NAMES[k]
    return "illegal"


@dataclass
class Token:
    kind: Kind
    lit: str = ""
    pos: int = 0


class Error(Exception):
    def __init__(self, pos: int, msg: str):
        super().__init__(msg)
        self.pos = pos
        self.msg = msg
