"""Chapter 3 index tests."""

from __future__ import annotations

import tempfile
import unittest

from findx.index import open_index
from findx.postings import Posting


class TestIndex(unittest.TestCase):
    def test_add_flush_open(self) -> None:
        with tempfile.TemporaryDirectory() as d:
            e = open_index(d)
            e.add("a", "The cat sat")
            e.add("b", "A cat and a dog")
            e.flush()
            e.add("c", "birds fly")
            e.flush()

            e2 = open_index(d)
            self.assertEqual(e2.num_docs(), 3)
            self.assertEqual(e2.postings("cat"), [Posting(0, 1), Posting(1, 1)])
            self.assertEqual(e2.ext_id(2), "c")
            self.assertEqual(len(e2.postings("fly")), 1)

    def test_duplicate_id(self) -> None:
        with tempfile.TemporaryDirectory() as d:
            e = open_index(d)
            e.add("x", "hi")
            with self.assertRaises(ValueError):
                e.add("x", "yo")


if __name__ == "__main__":
    unittest.main()
