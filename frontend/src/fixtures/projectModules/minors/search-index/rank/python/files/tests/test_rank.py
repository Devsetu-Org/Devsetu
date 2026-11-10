"""Chapter 5 rank tests."""

from __future__ import annotations

import math
import unittest
from typing import Dict

from findx.rank import Hit, Stats, collect_stats, idf, score, top_k


class StubDF:
    def __init__(self, n: int, avg: float, df: Dict[str, int]) -> None:
        self._n = n
        self._avg = avg
        self._df = df

    def num_docs(self) -> int:
        return self._n

    def avg_dl(self) -> float:
        return self._avg

    def df(self, term: str) -> int:
        return self._df[term]


class TestRank(unittest.TestCase):
    def test_idf(self) -> None:
        got = idf(100, 10)
        want = math.log(1 + (100 - 10 + 0.5) / (10 + 0.5))
        self.assertAlmostEqual(got, want)

    def test_score_monotonic_tf(self) -> None:
        st = Stats(n=100, avg_dl=50)
        self.assertGreater(score(5, 50, 10, st), score(1, 50, 10, st))

    def test_top_k_tie_break(self) -> None:
        hits = [Hit(3, 1.0), Hit(1, 2.0), Hit(2, 2.0), Hit(4, 0.5)]
        got = top_k(hits, 3)
        self.assertEqual(got, [Hit(1, 2.0), Hit(2, 2.0), Hit(3, 1.0)])

    def test_collect_stats(self) -> None:
        src = StubDF(10, 4, {"cat": 3, "dog": 1})
        st, df = collect_stats(src, ["cat", "dog", "cat"])
        self.assertEqual(st.n, 10)
        self.assertEqual(st.avg_dl, 4)
        self.assertEqual(df["cat"], 3)
        self.assertEqual(df["dog"], 1)


if __name__ == "__main__":
    unittest.main()
