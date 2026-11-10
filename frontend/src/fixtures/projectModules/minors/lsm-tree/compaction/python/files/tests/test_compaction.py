import tempfile, unittest
from lsmkv.db import Options, open_db
from lsmkv.wal import SyncMode

class CompactionTest(unittest.TestCase):
    def test_compact_merges_tables(self):
        with tempfile.TemporaryDirectory() as tmp:
            d = open_db(tmp, Options(sync=SyncMode.NEVER, compaction_trigger=-1))
            try:
                d.put(b"a", b"1"); d.Flush()
                d.put(b"b", b"2"); d.Flush()
                d.put(b"a", b"3"); d.Flush()
                self.assertEqual(d.stats().tables, 3)
                d.Compact()
                self.assertEqual(d.stats().tables, 1)
                v, ok = d.get(b"a")
                self.assertTrue(ok); self.assertEqual(v, b"3")
                v, ok = d.get(b"b")
                self.assertTrue(ok); self.assertEqual(v, b"2")
            finally:
                d.close()
            d = open_db(tmp, Options(sync=SyncMode.NEVER, compaction_trigger=-1))
            try:
                self.assertEqual(d.stats().tables, 1)
                v, ok = d.get(b"a")
                self.assertTrue(ok); self.assertEqual(v, b"3")
            finally:
                d.close()

if __name__ == "__main__":
    unittest.main()
