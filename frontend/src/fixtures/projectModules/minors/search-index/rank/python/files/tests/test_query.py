"""Chapter 4 query tests."""

from __future__ import annotations

import unittest
from typing import Dict, List

from findx.postings import Posting
from findx.query import Query, docs, intersect, parse, union


def p(doc_id: int, tf: int) -> Posting:
    return Posting(doc_id=doc_id, tf=tf)


class MemSrc:
    def __init__(self, data: Dict[str, List[Posting]]) -> None:
        self._data = data

    def postings(self, term: str) -> List[Posting]:
        return self._data.get(term, [])


class TestQuery(unittest.TestCase):
    def test_parse_and(self) -> None:
        self.assertEqual(parse("The Cat Dog"), Query(groups=[["cat", "dog"]]))

    def test_parse_or(self) -> None:
        self.assertEqual(parse("cat OR dog bird"), Query(groups=[["cat"], ["dog", "bird"]]))

    def test_intersect_union(self) -> None:
        a = [p(1, 1), p(3, 1), p(5, 1)]
        b = [p(3, 2), p(5, 1), p(7, 1)]
        c = [p(2, 1), p(5, 1)]
        self.assertEqual(intersect([a, b]), [3, 5])
        self.assertEqual(intersect([a, b, c]), [5])
        self.assertEqual(union([a, c]), [1, 2, 3, 5])

    def test_docs(self) -> None:
        src = MemSrc(
            {
                "cat": [p(1, 1), p(2, 1), p(3, 1)],
                "dog": [p(2, 1), p(3, 1)],
                "bird": [p(1, 1), p(4, 1)],
            }
        )
        self.assertEqual(docs(src, parse("cat dog")), [2, 3])
        self.assertEqual(docs(src, parse("cat OR bird")), [1, 2, 3, 4])


if __name__ == "__main__":
    unittest.main()
