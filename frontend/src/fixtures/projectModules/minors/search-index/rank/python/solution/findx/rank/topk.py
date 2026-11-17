"""Top-k selection by BM25 score."""

from __future__ import annotations

from dataclasses import dataclass
from typing import List


@dataclass
class Hit:
    doc_id: int
    score: float


def top_k(hits: List[Hit], k: int) -> List[Hit]:
    """Sort by descending score, then ascending doc_id; keep at most k.

    k <= 0 means all hits.
    """
    out = list(hits)
    out.sort(key=lambda h: (-h.score, h.doc_id))
    if k > 0 and len(out) > k:
        out = out[:k]
    return out
