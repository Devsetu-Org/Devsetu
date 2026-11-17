"""Apply redirects — pass-through until redirects chapter."""

from __future__ import annotations

from .run import Stdio


def apply_redirs_io(base: Stdio, redirs, files) -> Stdio:
    return base
