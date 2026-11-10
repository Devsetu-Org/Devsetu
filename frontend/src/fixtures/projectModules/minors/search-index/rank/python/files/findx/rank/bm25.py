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
    # TODO(5.2): Return 0 when n == 0 or df < 0. Otherwise
    # math.log(1 + (N - df + 0.5) / (df + 0.5)).
    _ = math.log
    _ = n
    _ = df
    raise NotImplementedError("TODO(5.2): idf")


def score(tf: int, dl: int, df: int, st: Stats) -> float:
    """BM25 contribution of one term for one document."""
    # TODO(5.2): Return 0 when tf <= 0, st.n == 0, or st.avg_dl == 0.
    # score = idf(st.n, df) * (tf * (K1+1)) / (tf + K1*(1 - B + B*dl/avg_dl)).
    _ = tf
    _ = dl
    _ = df
    _ = st
    raise NotImplementedError("TODO(5.2): score")
