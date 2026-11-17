"""Scanner cursor and Scan entry point."""

from __future__ import annotations

from .chars import op_start
from .token import EOF, Token


class Scanner:
    def __init__(self, src: str):
        self.src = src
        self.i = 0

    def eof(self) -> bool:
        return self.i >= len(self.src)

    def peek(self) -> str:
        if self.eof():
            return "\0"
        return self.src[self.i]

    def peek_at(self, off: int) -> str:
        j = self.i + off
        if j >= len(self.src):
            return "\0"
        return self.src[j]

    def bump(self) -> str:
        c = self.src[self.i]
        self.i += 1
        return c

    def skip_space(self) -> None:
        while not self.eof():
            c = self.peek()
            if c in " \t\n\r":
                self.i += 1
            else:
                return

    def at_op(self) -> bool:
        c = self.peek()
        if c in "|><&":
            return True
        if c == "2":
            return self.peek_at(1) == ">"
        return False

    def next(self) -> Token:
        from . import scan

        if self.at_op():
            return scan.scan_op(self)
        return scan.scan_word(self)


def Scan(src: str) -> list[Token]:
    s = Scanner(src)
    out: list[Token] = []
    while True:
        s.skip_space()
        if s.eof():
            out.append(Token(kind=EOF, pos=s.i))
            return out
        out.append(s.next())
