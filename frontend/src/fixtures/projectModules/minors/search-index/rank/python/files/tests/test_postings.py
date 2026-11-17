"""Chapter 2 postings tests."""

from __future__ import annotations

import io
import unittest

from findx.postings import Map, Posting, decode_segment, write_segment


class TestPostings(unittest.TestCase):
    def test_map_add_sorted(self) -> None:
        m = Map()
        m.add("cat", 3, 1)
        m.add("cat", 1, 2)
        m.add("cat", 2, 1)
        m.add("cat", 1, 5)
        self.assertEqual(
            m.postings("cat"),
            [Posting(1, 5), Posting(2, 1), Posting(3, 1)],
        )

    def test_segment_round_trip(self) -> None:
        m = Map()
        m.add("cat", 1, 2)
        m.add("cat", 3, 1)
        m.add("dog", 2, 4)
        m.add("apple", 1, 1)

        buf = io.BytesIO()
        write_segment(buf, m)
        seg = decode_segment(buf.getvalue())
        got, ok = seg.postings("cat")
        self.assertTrue(ok)
        self.assertEqual(got, [Posting(1, 2), Posting(3, 1)])
        got, ok = seg.postings("dog")
        self.assertTrue(ok)
        self.assertEqual(got, [Posting(2, 4)])
        _, ok = seg.postings("missing")
        self.assertFalse(ok)
        self.assertEqual(seg.terms(), ["apple", "cat", "dog"])


if __name__ == "__main__":
    unittest.main()
