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
    # TODO(5.3): Copy hits. Sort by score descending, then doc_id ascending.
    # If k > 0 and len > k, truncate to k.
    _ = hits
    _ = k
    raise NotImplementedError("TODO(5.3): top_k")
