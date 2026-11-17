"""Background marker parsing."""

from __future__ import annotations

from tinysh.lex.token import Amp


def take_background(p) -> bool:
    """take_background consumes a trailing & when present."""
    if p.kind() != Amp:
        return False
    p.bump()
    return True
