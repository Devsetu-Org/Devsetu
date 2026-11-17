"""Lookup helpers over flushed segments and the memory buffer."""

from __future__ import annotations

from typing import TYPE_CHECKING, List, Optional, Tuple

from findx.postings import Posting

if TYPE_CHECKING:
    from findx.index.meta import Engine, Meta


def postings(e: "Engine", term: str) -> List[Posting]:
    out: List[Posting] = []
    for seg in e.segs:
        lst, ok = seg.postings(term)
        if ok:
            out.extend(lst)
    mem = e.mem.postings(term)
    if mem:
        out.extend(mem)
    out.sort(key=lambda p: p.doc_id)
    return out


def doc(e: "Engine", internal_id: int) -> Tuple[Optional["Meta"], bool]:
    m = e.docs.get(internal_id)
    if m is None:
        return None, False
    return m, True


def num_docs(e: "Engine") -> int:
    return len(e.docs)


def avg_dl(e: "Engine") -> float:
    if not e.docs:
        return 0.0
    return sum(m.length for m in e.docs.values()) / len(e.docs)


def df(e: "Engine", term: str) -> int:
    return len(postings(e, term))


def ext_id(e: "Engine", internal_id: int) -> str:
    return e.docs[internal_id].ext_id
