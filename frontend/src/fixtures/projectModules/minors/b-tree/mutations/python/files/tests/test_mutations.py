"""Delete and Scan acceptance tests."""

from __future__ import annotations

import tempfile
import unittest

from btreekv.db import DB


class MutationsTest(unittest.TestCase):
    def test_delete_and_scan(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            d = DB.open(td)
            try:
                for i in range(500):
                    d.put(f"k{i:04d}".encode(), f"v{i}".encode())
                for i in range(0, 500, 2):
                    self.assertTrue(d.delete(f"k{i:04d}".encode()))
                got = []
                d.scan(b"k0100", b"k0200", lambda k, v: (got.append((k, v)) or True))
                self.assertTrue(all(int(k[1:]) % 2 == 1 for k, _ in got))
                self.assertGreater(len(got), 0)
                s = d.stats()
                self.assertEqual(s.keys, 250)
            finally:
                d.close()

    def test_delete_all(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            d = DB.open(td)
            try:
                for i in range(100):
                    d.put(f"k{i:03d}".encode(), b"x")
                for i in range(100):
                    d.delete(f"k{i:03d}".encode())
                self.assertEqual(d.stats().keys, 0)
                self.assertEqual(d.stats().height, 0)
            finally:
                d.close()


if __name__ == "__main__":
    unittest.main()
