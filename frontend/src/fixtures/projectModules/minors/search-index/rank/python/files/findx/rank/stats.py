"""Collection statistics for BM25."""

from __future__ import annotations

from typing import Dict, List, Protocol, Tuple

from findx.rank.bm25 import Stats


class DocFreq(Protocol):
    def num_docs(self) -> int: ...

    def avg_dl(self) -> float: ...

    def df(self, term: str) -> int: ...


def collect_stats(src: DocFreq, terms: List[str]) -> Tuple[Stats, Dict[str, int]]:
    """Build collection Stats and a per-term DF map for terms."""
    # TODO(5.1): Stats(n=src.num_docs(), avg_dl=src.avg_dl()). For each distinct
    # term, df[term] = src.df(term). Return stats and the map.
    _ = Stats
    _ = src
    _ = terms
    raise NotImplementedError("TODO(5.1): collect_stats")
