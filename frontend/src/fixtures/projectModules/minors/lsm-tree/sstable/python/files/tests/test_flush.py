import glob
import os
import random
import tempfile
import unittest

from lsmkv.db import Options, open_db
from lsmkv.wal import SyncMode


class FlushTest(unittest.TestCase):
    def open(self, directory: str, small: bool = False):
        if small:
            return open_db(
                directory,
                Options(sync=SyncMode.NEVER, memtable_size=4 << 10, block_size=512),
            )
        return open_db(directory, Options(sync=SyncMode.NEVER))

    def must_get(self, d, key: str, want: str, want_ok: bool) -> None:
        v, ok = d.get(key.encode())
        self.assertEqual(ok, want_ok)
        if want_ok:
            self.assertEqual(v, want.encode())

    def table_files(self, directory: str):
        return glob.glob(os.path.join(directory, "*.sst"))

    def test_flush_writes_a_table(self):
        with tempfile.TemporaryDirectory() as tmp:
            d = self.open(tmp)
            try:
                d.put(b"order:1", b"paid")
                d.delete(b"order:2")
                d.Flush()
                self.assertEqual(len(self.table_files(tmp)), 1)
                s = d.stats()
                self.assertEqual((s.memtable_entries, s.tables), (0, 1))
                self.assertEqual(s.wal_bytes, 0)
                self.must_get(d, "order:1", "paid", True)
                self.must_get(d, "order:2", "", False)
            finally:
                d.close()

    def test_flush_on_full_memtable(self):
        with tempfile.TemporaryDirectory() as tmp:
            d = self.open(tmp, small=True)
            for i in range(2000):
                d.put(f"order:{i:05d}".encode(), b"pending-payment")
            self.assertGreaterEqual(len(self.table_files(tmp)), 5)
            d.close()
            d = self.open(tmp, small=True)
            try:
                for i in range(2000):
                    self.must_get(d, f"order:{i:05d}", "pending-payment", True)
            finally:
                d.close()

    def test_newest_version_wins(self):
        with tempfile.TemporaryDirectory() as tmp:
            d = self.open(tmp)
            d.put(b"order:1", b"pending")
            d.put(b"order:2", b"pending")
            d.Flush()
            d.put(b"order:1", b"paid")
            d.delete(b"order:2")
            d.Flush()
            d.put(b"order:1", b"shipped")
            self.must_get(d, "order:1", "shipped", True)
            self.must_get(d, "order:2", "", False)
            d.close()
            d = self.open(tmp)
            try:
                self.must_get(d, "order:1", "shipped", True)
                self.must_get(d, "order:2", "", False)
            finally:
                d.close()

    def test_tables_are_numbered_and_survive_reopen(self):
        with tempfile.TemporaryDirectory() as tmp:
            d = self.open(tmp)
            for i in range(3):
                d.put(b"k", str(i).encode())
                d.Flush()
            d.close()
            for name in ("000001.sst", "000002.sst", "000003.sst"):
                self.assertTrue(os.path.exists(os.path.join(tmp, name)))
            d = self.open(tmp)
            try:
                self.must_get(d, "k", "2", True)
                d.put(b"k", b"3")
                d.Flush()
                self.assertTrue(os.path.exists(os.path.join(tmp, "000004.sst")))
            finally:
                d.close()

    def test_leftover_temp_file_is_ignored(self):
        with tempfile.TemporaryDirectory() as tmp:
            d = self.open(tmp)
            d.put(b"k", b"v")
            d.Flush()
            d.close()
            open(os.path.join(tmp, "000002.sst.tmp"), "wb").write(b"half a table")
            d = self.open(tmp)
            try:
                self.must_get(d, "k", "v", True)
            finally:
                d.close()

    def test_random_ops_across_flushes(self):
        with tempfile.TemporaryDirectory() as tmp:
            model = {}
            rnd = random.Random(3)
            d = self.open(tmp, small=True)
            for _round in range(4):
                for _i in range(1500):
                    k = f"key:{rnd.randrange(600):04d}"
                    if rnd.randrange(5) == 0:
                        d.delete(k.encode())
                        model.pop(k, None)
                    else:
                        v = f"v{rnd.randrange(1 << 30)}"
                        d.put(k.encode(), v.encode())
                        model[k] = v
                d.close()
                d = self.open(tmp, small=True)
                for i in range(600):
                    k = f"key:{i:04d}"
                    want = model.get(k)
                    self.must_get(d, k, want or "", want is not None)
            d.close()


if __name__ == "__main__":
    unittest.main()
