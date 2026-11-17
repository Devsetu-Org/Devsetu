import unittest
from lsmkv.iterator import Merging
from lsmkv.memtable import Memtable
from lsmkv.memtable.skiplist import Kind

class MergingTest(unittest.TestCase):
    def test_merges_and_keeps_newest(self):
        a, b = Memtable(), Memtable()
        a.put(b"k1", b"old"); a.put(b"k2", b"a2")
        b.put(b"k1", b"new"); b.put(b"k3", b"b3")
        # b is newer (first child)
        m = Merging(b.new_iterator(), a.new_iterator())
        m.seek_to_first()
        got = []
        while m.valid():
            got.append((m.key(), m.value(), m.kind()))
            m.next()
        self.assertEqual([(k, v) for k,v,_ in got], [(b"k1", b"new"), (b"k2", b"a2"), (b"k3", b"b3")])

    def test_tombstone_returned(self):
        a, b = Memtable(), Memtable()
        a.put(b"k", b"v")
        b.delete(b"k")
        m = Merging(b.new_iterator(), a.new_iterator())
        m.seek_to_first()
        self.assertTrue(m.valid())
        self.assertEqual(m.kind(), Kind.TOMBSTONE)

if __name__ == "__main__":
    unittest.main()
