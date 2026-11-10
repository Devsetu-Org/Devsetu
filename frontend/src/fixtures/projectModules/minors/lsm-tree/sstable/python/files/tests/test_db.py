import os
import random
import tempfile
import threading
import unittest

from lsmkv.db import ErrClosed, Options, open_db
from lsmkv.wal import SyncMode


class DbTest(unittest.TestCase):
    def open(self, directory: str):
        return open_db(directory, Options(sync=SyncMode.NEVER))

    def must_get(self, d, key: str, want: str, want_ok: bool) -> None:
        v, ok = d.get(key.encode())
        self.assertEqual(ok, want_ok, f"get({key!r}) ok")
        if want_ok:
            self.assertEqual(v, want.encode(), f"get({key!r}) value")

    def test_put_delete_get(self):
        with tempfile.TemporaryDirectory() as tmp:
            d = self.open(tmp)
            try:
                d.put(b"order:1", b"pending")
                d.put(b"order:2", b"paid")
                d.delete(b"order:1")
                self.must_get(d, "order:1", "", False)
                self.must_get(d, "order:2", "paid", True)
                self.must_get(d, "order:3", "", False)
            finally:
                d.close()

    def test_reopen_recovers_everything(self):
        with tempfile.TemporaryDirectory() as tmp:
            d = self.open(tmp)
            d.put(b"order:1", b"pending")
            d.put(b"order:1", b"paid")
            d.put(b"order:2", b"pending")
            d.delete(b"order:2")
            d.close()

            d = self.open(tmp)
            try:
                self.must_get(d, "order:1", "paid", True)
                self.must_get(d, "order:2", "", False)
                self.assertEqual(
                    d.stats().memtable_entries,
                    2,
                    "after reopen the memtable should have 2 entries",
                )
            finally:
                d.close()

    def test_without_close_nothing_is_lost(self):
        with tempfile.TemporaryDirectory() as tmp:
            d = self.open(tmp)
            d.put(b"k", b"v")
            # Simulate a crash: no close. The log must already hold the write.
            d2 = self.open(tmp)
            try:
                self.must_get(d2, "k", "v", True)
            finally:
                d2.close()
            try:
                d.close()
            except Exception:
                pass

    def test_torn_tail_is_cut_before_new_writes(self):
        with tempfile.TemporaryDirectory() as tmp:
            d = self.open(tmp)
            d.put(b"a", b"1")
            d.put(b"b", b"2")
            d.close()

            path = os.path.join(tmp, "wal.log")
            with open(path, "ab") as f:
                f.write(bytes([0xDE, 0xAD, 0xBE, 0xEF, 0x40, 0, 0, 0, 1, 2]))

            d = self.open(tmp)
            self.must_get(d, "a", "1", True)
            self.must_get(d, "b", "2", True)
            d.put(b"c", b"3")
            d.close()

            d = self.open(tmp)
            try:
                self.must_get(d, "c", "3", True)
            finally:
                d.close()

    def test_write_fails_after_close(self):
        with tempfile.TemporaryDirectory() as tmp:
            d = self.open(tmp)
            d.close()
            with self.assertRaises(ErrClosed):
                d.put(b"k", b"v")

    def test_random_ops_survive_reopen(self):
        with tempfile.TemporaryDirectory() as tmp:
            model = {}
            rnd = random.Random(7)
            d = self.open(tmp)
            for _round in range(5):
                for _i in range(400):
                    k = f"key:{rnd.randrange(150):03d}"
                    if rnd.randrange(4) == 0:
                        d.delete(k.encode())
                        model.pop(k, None)
                    else:
                        v = f"v{rnd.randrange(1 << 30)}"
                        d.put(k.encode(), v.encode())
                        model[k] = v
                d.close()
                d = self.open(tmp)
                for i in range(150):
                    k = f"key:{i:03d}"
                    want = model.get(k)
                    self.must_get(d, k, want or "", want is not None)
            d.close()

    def test_concurrent_writers(self):
        with tempfile.TemporaryDirectory() as tmp:
            d = self.open(tmp)
            errors = []

            def worker(g: int) -> None:
                try:
                    for i in range(200):
                        d.put(f"g{g}:{i:03d}".encode(), b"v")
                except Exception as e:  # noqa: BLE001
                    errors.append(e)

            threads = [threading.Thread(target=worker, args=(g,)) for g in range(8)]
            for t in threads:
                t.start()
            for t in threads:
                t.join()
            self.assertEqual(errors, [])
            d.close()
            d = self.open(tmp)
            try:
                self.assertEqual(d.stats().memtable_entries, 1600)
            finally:
                d.close()


if __name__ == "__main__":
    unittest.main()
