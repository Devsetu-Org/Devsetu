"""DB tests that exercise the write-ahead log."""

from __future__ import annotations

import os
import tempfile
import unittest

from btreekv.db import DB, Options
from btreekv.wal import SyncMode


class DBWALTest(unittest.TestCase):
    def test_put_survives_reopen(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            d = DB.open(td)
            d.put(b"a", b"1")
            d.put(b"b", b"2")
            d.close()
            d = DB.open(td)
            try:
                v, ok = d.get(b"a")
                self.assertTrue(ok and v == b"1")
                v, ok = d.get(b"b")
                self.assertTrue(ok and v == b"2")
            finally:
                d.close()

    def test_crash_before_close_keeps_committed(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            d = DB.open(td, Options(sync=SyncMode.ALWAYS))
            d.put(b"k", b"v")
            # Simulate crash: drop without checkpoint/close.
            os.close(d.pg._fd)
            d.pg._fd = -1
            d.log._fd = -1 if d.log else -1
            d.closed = True
            d = DB.open(td)
            try:
                v, ok = d.get(b"k")
                self.assertTrue(ok and v == b"v")
            finally:
                d.close()

    def test_many_puts_with_wal(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            d = DB.open(td)
            try:
                for i in range(500):
                    d.put(f"k{i:04d}".encode(), f"v{i}".encode())
                s = d.stats()
                self.assertEqual(s.keys, 500)
                self.assertGreater(s.wal_bytes, 0)
            finally:
                d.close()


if __name__ == "__main__":
    unittest.main()
