import os
import struct
import tempfile
import unittest

from lsmkv.memtable import Result
from lsmkv.memtable.skiplist import Kind
from lsmkv.sstable import OutOfOrderError, WriterOptions, create, open_table
from lsmkv.sstable.format import FOOTER_SIZE, MAGIC


def key(i: int) -> bytes:
    return f"order:{i:06d}".encode()


def build(n: int, block_size: int) -> str:
    tmp = tempfile.mkdtemp()
    path = os.path.join(tmp, "000001.sst")
    w = create(path, WriterOptions(block_size=block_size))
    for i in range(n):
        k = key(2 * i)
        if i % 10 == 0:
            w.Add(Kind.TOMBSTONE, k, None)
        else:
            w.Add(Kind.VALUE, k, f"value-{2 * i}".encode())
    w.Finish()
    return path


class SSTableTest(unittest.TestCase):
    def test_footer_and_index(self):
        path = build(1000, 512)
        data = open(path, "rb").read()
        footer = data[-FOOTER_SIZE:]
        self.assertEqual(struct.unpack_from("<Q", footer, 32)[0], MAGIC)
        tbl = open_table(path)
        try:
            self.assertGreaterEqual(tbl.num_blocks(), 10)
            for i in range(1, len(tbl.index)):
                self.assertLess(tbl.index[i - 1].last_key, tbl.index[i].last_key)
            self.assertEqual(tbl.index[-1].last_key, key(2 * 999))
        finally:
            tbl.close()

    def test_get_every_key(self):
        tbl = open_table(build(2000, 1024))
        try:
            for i in range(2000):
                v, res = tbl.get(key(2 * i))
                if i % 10 == 0:
                    self.assertIs(res, Result.DELETED)
                    self.assertIsNone(v)
                else:
                    self.assertIs(res, Result.FOUND)
                    self.assertEqual(v, f"value-{2 * i}".encode())
        finally:
            tbl.close()

    def test_get_missing_keys(self):
        tbl = open_table(build(2000, 1024))
        try:
            for k in [b"a", key(1), key(2001), key(3999), key(4000), b"order:9999999", b"zzz"]:
                v, res = tbl.get(k)
                self.assertIs(res, Result.MISSING)
                self.assertIsNone(v)
        finally:
            tbl.close()

    def test_one_block_per_lookup(self):
        tbl = open_table(build(5000, 1024))
        try:
            before = tbl.block_reads()
            for i in range(100):
                tbl.get(key(2 * i * 37 % 10000))
            self.assertEqual(tbl.block_reads() - before, 100)
        finally:
            tbl.close()

    def test_out_of_order_add(self):
        path = os.path.join(tempfile.mkdtemp(), "x.sst")
        w = create(path, WriterOptions())
        try:
            w.Add(Kind.VALUE, b"b", None)
            with self.assertRaises(OutOfOrderError):
                w.Add(Kind.VALUE, b"a", None)
            with self.assertRaises(OutOfOrderError):
                w.Add(Kind.VALUE, b"b", None)
        finally:
            w.abort()

    def test_empty_table(self):
        tbl = open_table(build(0, 0))
        try:
            v, res = tbl.get(b"anything")
            self.assertIs(res, Result.MISSING)
            it = tbl.new_iterator()
            it.seek_to_first()
            self.assertFalse(it.valid())
        finally:
            tbl.close()

    def test_corruption_is_detected(self):
        path = build(500, 512)
        data = open(path, "rb").read()
        bad = bytearray(data)
        bad[-1] ^= 0xFF
        open(path, "wb").write(bad)
        with self.assertRaises(Exception):
            open_table(path)

        short = os.path.join(tempfile.mkdtemp(), "short.sst")
        open(short, "wb").write(data[:20])
        with self.assertRaises(Exception):
            open_table(path if False else short)

        flipped = bytearray(data)
        flipped[10] ^= 0xFF
        open(path, "wb").write(flipped)
        tbl = open_table(path)
        try:
            with self.assertRaises(Exception):
                tbl.get(key(2))
        finally:
            tbl.close()

    def test_iterator_walks_everything(self):
        tbl = open_table(build(3000, 700))
        try:
            it = tbl.new_iterator()
            n = 0
            it.seek_to_first()
            while it.valid():
                self.assertEqual(it.key(), key(2 * n))
                n += 1
                it.next()
            self.assertEqual(n, 3000)
            it.seek(key(2001))
            self.assertTrue(it.valid())
            self.assertEqual(it.key(), key(2002))
        finally:
            tbl.close()


if __name__ == "__main__":
    unittest.main()
