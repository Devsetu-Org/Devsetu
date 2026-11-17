"""Add a document into the in-memory posting buffer."""

from __future__ import annotations

from typing import TYPE_CHECKING, Dict

from findx.analyze import analyze

if TYPE_CHECKING:
    from findx.index.meta import Engine


def add(e: "Engine", doc_id: str, text: str) -> None:
    """Analyze text, assign an internal id, record length, buffer postings.

    Does not write disk; call flush.
    """
    if doc_id == "":
        raise ValueError("empty document id")
    if doc_id in e.ext_to_id:
        raise ValueError(f"duplicate document id {doc_id!r}")
    tokens = analyze(text)
    tf: Dict[str, int] = {}
    for t in tokens:
        tf[t] = tf.get(t, 0) + 1
    internal = e.next_doc
    e.next_doc += 1
    from findx.index.meta import Meta

    e.docs[internal] = Meta(ext_id=doc_id, length=len(tokens))
    e.ext_to_id[doc_id] = internal
    e.buf_lens[internal] = len(tokens)
    for term, n in tf.items():
        e.mem.add(term, internal, n)
