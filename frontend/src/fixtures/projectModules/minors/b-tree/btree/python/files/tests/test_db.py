"""Acceptance tests for the DB API (chapter 2)."""

from __future__ import annotations

import tempfile
import threading
import unittest

from btreekv.db import DB, ErrClosed


class DBTest(unittest.TestCase):
    def open_db(self, dir: str) -> DB:
        return DB.open(dir)

    def must_get(self, d: DB, key: str, want: str, want_ok: bool) -> None:
        v, ok = d.get(key.encode())
        self.assertEqual(ok, want_ok)
        if want_ok:
            self.assertEqual(v.decode(), want)

    def test_put_get_overwrite(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            d = self.open_db(td)
            try:
                d.put(b"order:1", b"pending")
                d.put(b"order:2", b"paid")
                d.put(b"order:1", b"shipped")
                self.must_get(d, "order:1", "shipped", True)
                self.must_get(d, "order:2", "paid", True)
                self.must_get(d, "order:3", "", False)
            finally:
                d.close()

    def test_get_returns_a_copy(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            d = self.open_db(td)
            try:
                d.put(b"k", b"value")
                v, _ = d.get(b"k")
                assert v is not None
                # bytes are immutable in Python; mutating a bytearray copy would be the Go test.
                # Re-get to confirm value unchanged.
                self.must_get(d, "k", "value", True)
            finally:
                d.close()

    def test_many_keys_split_the_tree(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            d = self.open_db(td)
            try:
                n = 3000
                for i in range(n):
                    d.put(f"user:{(i * 7919) % n:05d}".encode(), f"name-{i}".encode())
                s = d.stats()
                self.assertEqual(s.keys, n)
                self.assertGreaterEqual(s.height, 2)
            finally:
                d.close()

    def test_reopen_keeps_everything(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            d = self.open_db(td)
            for i in range(1500):
                d.put(f"k{i:04d}".encode(), f"v{i}".encode())
            d.close()
            d = self.open_db(td)
            try:
                for i in range(0, 1500, 11):
                    self.must_get(d, f"k{i:04d}", f"v{i}", True)
                s = d.stats()
                self.assertEqual(s.keys, 1500)
            finally:
                d.close()

    def test_closed_db(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            d = self.open_db(td)
            d.close()
            with self.assertRaises(ErrClosed):
                d.put(b"k", b"v")
            with self.assertRaises(ErrClosed):
                d.get(b"k")
            with self.assertRaises(ErrClosed):
                d.close()

    def test_concurrent_put_get(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            d = self.open_db(td)
            try:
                errors: list[str] = []

                def worker(w: int) -> None:
                    try:
                        for i in range(300):
                            k = f"w{w}-{i:04d}".encode()
                            d.put(k, k)
                            v, ok = d.get(k)
                            if not ok or v != k:
                                errors.append(f"Get({k!r}) = {v!r}, {ok}")
                                return
                    except Exception as e:
                        errors.append(str(e))

                threads = [threading.Thread(target=worker, args=(w,)) for w in range(4)]
                for t in threads:
                    t.start()
                for t in threads:
                    t.join()
                self.assertEqual(errors, [])
                self.assertEqual(d.stats().keys, 1200)
            finally:
                d.close()


if __name__ == "__main__":
    unittest.main()
