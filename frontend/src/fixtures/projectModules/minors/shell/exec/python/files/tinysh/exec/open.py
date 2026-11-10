"""Open redirects — no-op until redirects chapter."""

from __future__ import annotations


def open_redirs(directory: str, redirs):
    if not redirs:
        return []
    raise OSError("redirects not supported yet")
