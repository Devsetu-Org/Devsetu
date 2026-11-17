"""Analyze turns document or query text into index tokens."""

from __future__ import annotations

from findx.analyze.stopwords import STOPWORDS


def analyze(text: str) -> list[str]:
    """Split on non-letters, lowercase, drop stopwords."""
    return filter_stop(lower(tokenize(text)))


def tokenize(text: str) -> list[str]:
    """Split text into runs of Unicode letters. Digits and punctuation separate tokens."""
    out: list[str] = []
    buf: list[str] = []

    def flush() -> None:
        if buf:
            out.append("".join(buf))
            buf.clear()

    for ch in text:
        if ch.isalpha():
            buf.append(ch)
            continue
        flush()
    flush()
    return out


def lower(tokens: list[str]) -> list[str]:
    """Return a new list with each token lowercased (Unicode)."""
    return [t.lower() for t in tokens]


def filter_stop(tokens: list[str]) -> list[str]:
    """Drop tokens that appear in STOPWORDS. Tokens must already be lowercased."""
    return [t for t in tokens if t not in STOPWORDS]
