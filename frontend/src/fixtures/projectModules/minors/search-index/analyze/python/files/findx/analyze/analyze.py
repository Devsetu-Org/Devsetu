"""Analyze turns document or query text into index tokens."""

from __future__ import annotations

from findx.analyze.stopwords import STOPWORDS


def analyze(text: str) -> list[str]:
    """Split on non-letters, lowercase, drop stopwords."""
    return filter_stop(lower(tokenize(text)))


def tokenize(text: str) -> list[str]:
    """Split text into runs of Unicode letters. Digits and punctuation separate tokens."""
    # TODO(1.1): Walk characters. Append a token whenever a run of str.isalpha
    # ends. Do not keep digits or punctuation. Case is preserved.
    raise NotImplementedError("TODO(1.1): tokenize")


def lower(tokens: list[str]) -> list[str]:
    """Return a new list with each token lowercased (Unicode)."""
    # TODO(1.2): Allocate an output list the same length. Call .lower() on each token.
    raise NotImplementedError("TODO(1.2): lower")


def filter_stop(tokens: list[str]) -> list[str]:
    """Drop tokens that appear in STOPWORDS. Tokens must already be lowercased."""
    # TODO(1.3): Keep tokens that are not in STOPWORDS. Preserve order.
    raise NotImplementedError("TODO(1.3): filter_stop")
