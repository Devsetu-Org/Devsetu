"""BM25 scoring with fixed k1=1.2 and b=0.75."""

from __future__ import annotations

import math
from dataclasses import dataclass

K1 = 1.2
B = 0.75


@dataclass
class Stats:
    n: int  # number of documents
    avg_dl: float  # average document length


def idf(n: int, df: int) -> float:
    """BM25+ style idf: ln(1 + (N - df + 0.5) / (df + 0.5))."""
    if n == 0 or df < 0:
        return 0.0
    return math.log(1 + (n - df + 0.5) / (df + 0.5))


def score(tf: int, dl: int, df: int, st: Stats) -> float:
    """BM25 contribution of one term for one document."""
    if tf <= 0 or st.n == 0 or st.avg_dl == 0:
        return 0.0
    idf_v = idf(st.n, df)
    tf_comp = (tf * (K1 + 1)) / (tf + K1 * (1 - B + B * dl / st.avg_dl))
    return idf_v * tf_comp
