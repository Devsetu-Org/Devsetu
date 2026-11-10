"""Scanner walks one SQL string. The four scan methods are the chapter's work."""

from __future__ import annotations

from sqlq.lex.chars import is_digit, is_ident_start
from sqlq.lex.scan import scan_ident, scan_number, scan_string, scan_symbol
from sqlq.lex.token import EOF, Token


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

    def next(self) -> Token:
        c = self.peek()
        if is_ident_start(c):
            return scan_ident(self)
        if is_digit(c):
            return scan_number(self)
        if c == "'":
            return scan_string(self)
        return scan_symbol(self)


def Scan(src: str) -> list[Token]:
    """Return every token, including a final EOF."""
    s = Scanner(src)
    out: list[Token] = []
    while True:
        s.skip_space()
        if s.eof():
            out.append(Token(kind=EOF, pos=s.i))
            return out
        out.append(s.next())
