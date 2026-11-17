"""Add a document into the in-memory posting buffer."""

from __future__ import annotations

from typing import TYPE_CHECKING

from findx.analyze import analyze

if TYPE_CHECKING:
    from findx.index.meta import Engine


def add(e: "Engine", doc_id: str, text: str) -> None:
    """Analyze text, assign an internal id, record length, buffer postings.

    Does not write disk; call flush.
    """
    # TODO(3.1)
    _ = analyze
    _ = e
    _ = doc_id
    _ = text
    raise NotImplementedError("TODO(3.1)")
