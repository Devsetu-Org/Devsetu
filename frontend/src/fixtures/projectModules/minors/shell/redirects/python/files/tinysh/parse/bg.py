"""Background marker — rejected until the jobs chapter."""

from __future__ import annotations

from tinysh.lex.token import Amp


def take_background(p) -> bool:
    if p.kind() == Amp:
        raise p.errf("background jobs not supported yet")
    return False
