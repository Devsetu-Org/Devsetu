from __future__ import annotations
import os, tempfile, unittest
from btreekv.db import DB, Options
from btreekv.buffer import Pool
from btreekv.pager import Pager
from btreekv.pager.page import PAGE_SIZE

class BufferTest(unittest.TestCase):
    def test_small_pool_put_get(self):
        with tempfile.TemporaryDirectory() as td:
            d = DB.open(td, Options(pool_frames=4))
            try:
                for i in range(200):
                    d.put(f"k{i:04d}".encode(), f"v{i}".encode())
                for i in range(0, 200, 7):
                    v, ok = d.get(f"k{i:04d}".encode())
                    self.assertTrue(ok and v == f"v{i}".encode())
                s = d.stats()
                self.assertEqual(s.keys, 200)
                self.assertLessEqual(s.resident, 4)
            finally:
                d.close()

    def test_pin_unpin_roundtrip(self):
        with tempfile.TemporaryDirectory() as td:
            p = Pager.open(os.path.join(td, "data.db"))
            try:
                pool = Pool(p, 2)
                no = p.allocate()
                buf = bytearray(PAGE_SIZE)
                buf[0] = 7
                pool.write_page(no, buf)
                got = bytearray(PAGE_SIZE)
                pool.read_page(no, got)
                self.assertEqual(got[0], 7)
                pool.flush_all()
            finally:
                p.close()

if __name__ == "__main__":
    unittest.main()
