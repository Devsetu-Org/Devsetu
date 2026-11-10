"""End-to-end Search tests (chapter 5)."""

from __future__ import annotations

import math
import tempfile
import unittest

from findx.findx import open_index_dir


class TestFindx(unittest.TestCase):
    def test_search_and_or_rank(self) -> None:
        with tempfile.TemporaryDirectory() as d:
            idx = open_index_dir(d)
            for doc_id, text in [
                ("d0", "cat cat cat"),
                ("d1", "cat dog"),
                ("d2", "dog dog dog"),
                ("d3", "bird flies"),
            ]:
                idx.add(doc_id, text)
            idx.flush()

            hits = idx.search("cat", 10)
            self.assertEqual(len(hits), 2)
            self.assertEqual(hits[0].id, "d0")
            self.assertEqual(hits[1].id, "d1")
            self.assertGreater(hits[0].score, hits[1].score)

            hits = idx.search("cat dog", 10)
            self.assertEqual(len(hits), 1)
            self.assertEqual(hits[0].id, "d1")

            hits = idx.search("cat OR bird", 10)
            ids = {h.id for h in hits}
            self.assertTrue({"d0", "d1", "d3"} <= ids)
            self.assertNotIn("d2", ids)
            for h in hits:
                self.assertFalse(math.isnan(h.score))

            hits = idx.search("cat", 1)
            self.assertEqual(len(hits), 1)
            self.assertEqual(hits[0].id, "d0")

    def test_search_reopen(self) -> None:
        with tempfile.TemporaryDirectory() as d:
            idx = open_index_dir(d)
            idx.add("a", "red fox")
            idx.flush()
            idx2 = open_index_dir(d)
            hits = idx2.search("fox", 5)
            self.assertEqual(len(hits), 1)
            self.assertEqual(hits[0].id, "a")


if __name__ == "__main__":
    unittest.main()
