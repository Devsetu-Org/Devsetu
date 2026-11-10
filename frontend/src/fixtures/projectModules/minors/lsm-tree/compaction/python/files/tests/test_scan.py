import tempfile
import unittest
from lsmkv.db import Options, open_db
from lsmkv.wal import SyncMode

class ScanTest(unittest.TestCase):
    def open(self, d):
        return open_db(d, Options(sync=SyncMode.NEVER, memtable_size=1<<20))

    def test_scan_range_and_tombstones(self):
        with tempfile.TemporaryDirectory() as tmp:
            d = self.open(tmp)
            try:
                for i in range(10):
                    d.put(f"k{i:02d}".encode(), b"v")
                d.delete(b"k05")
                d.Flush()
                d.put(b"k05", b"revived")
                out = []
                d.scan(b"k03", b"k08", lambda k, v: out.append((k, v)) or True)
                self.assertEqual(out, [
                    (b"k03", b"v"), (b"k04", b"v"), (b"k05", b"revived"),
                    (b"k06", b"v"), (b"k07", b"v"),
                ])
            finally:
                d.close()

if __name__ == "__main__":
    unittest.main()
