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
    # TODO(3.1): Reject an empty id and a duplicate e.ext_to_id[id].
    # tokens = analyze(text). Count tf per term. Assign internal := e.next_doc
    # and increment. Store Meta(ext_id=id, length=len(tokens)) in e.docs, update
    # e.ext_to_id and e.buf_lens, then e.mem.add(term, internal, tf) for each term.
    _ = analyze
    _ = e
    _ = doc_id
    _ = text
    raise NotImplementedError("TODO(3.1): Engine.add")
