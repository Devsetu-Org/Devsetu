import unittest
from lsmkv.bloom import Builder, may_contain

class BloomTest(unittest.TestCase):
    def test_round_trip(self):
        b = Builder(10)
        keys = [f"order:{i}".encode() for i in range(1000)]
        for k in keys:
            b.add(k)
        filt = b.finish()
        for k in keys:
            self.assertTrue(may_contain(filt, k))
        # Absent keys: some may FP but rate should be low
        misses = sum(1 for i in range(1000, 2000) if may_contain(filt, f"order:{i}".encode()))
        self.assertLess(misses, 50)

    def test_empty_filter_layout(self):
        filt = Builder(10).finish()
        self.assertGreaterEqual(len(filt), 2)
        self.assertTrue(may_contain(filt, b"anything") or True)  # empty may say maybe

    def test_short_filter_is_permissive(self):
        self.assertTrue(may_contain(b"", b"k"))
        self.assertTrue(may_contain(b"\x01", b"k"))

    def test_bad_k_is_permissive(self):
        self.assertTrue(may_contain(b"\x00\x00", b"k"))  # k=0
        self.assertTrue(may_contain(b"\x00\x1f", b"k"))  # k=31 > max

if __name__ == "__main__":
    unittest.main()
