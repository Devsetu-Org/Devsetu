import os
import struct
import tempfile
import unittest

from lsmkv.memtable.skiplist import Kind
from lsmkv.wal import SyncMode, create, encode, replay
from lsmkv.wal.record import HEADER_SIZE, Record


def put(k: str, v: str) -> Record:
    return Record(kind=Kind.VALUE, key=k.encode(), value=v.encode())


def delete(k: str) -> Record:
    return Record(kind=Kind.TOMBSTONE, key=k.encode(), value=None)


def write_log(path: str, *recs: Record) -> None:
    w = create(path, SyncMode.NEVER)
    for r in recs:
        w.append(r)
    w.close()


def replay_all(path: str):
    got = []

    def on_record(r: Record) -> None:
        got.append(
            Record(
                kind=r.kind,
                key=bytes(r.key),
                value=None if r.value is None else bytes(r.value),
            )
        )

    good = replay(path, on_record)
    return got, good


def same_records(test: unittest.TestCase, got, want) -> None:
    test.assertEqual(len(got), len(want), f"replayed {len(got)} records, want {len(want)}")
    for i, (g, w) in enumerate(zip(got, want)):
        test.assertEqual(g.kind, w.kind, f"record {i} kind")
        test.assertEqual(g.key, w.key, f"record {i} key")
        test.assertEqual(g.value, w.value, f"record {i} value")


class WalTest(unittest.TestCase):
    def test_encode_layout(self):
        b = encode(bytearray(), put("k", "vv"))
        # payload: kind(1) + keyLen(1) + "k" + valueLen(1) + "vv" = 6 bytes
        self.assertEqual(
            len(b),
            HEADER_SIZE + 6,
            f"encoded length = {len(b)}, want {HEADER_SIZE + 6}",
        )
        n = struct.unpack_from("<I", b, 4)[0]
        self.assertEqual(n, 6, f"length field = {n}, want 6 (payload bytes only)")
        want_payload = bytes([Kind.VALUE.value, 1, ord("k"), 2, ord("v"), ord("v")])
        self.assertEqual(bytes(b[HEADER_SIZE:]), want_payload)
        checksum = struct.unpack_from("<I", b, 0)[0]
        self.assertNotEqual(checksum, 0, "checksum field is zero; it should be the CRC-32C of the payload")
        # encode appends; it must not overwrite what dst already holds.
        prefix = bytearray(b"keep")
        b2 = encode(bytearray(prefix), put("k", "vv"))
        self.assertEqual(bytes(b2[:4]), b"keep")
        self.assertEqual(bytes(b2[4:]), bytes(b))

    def test_round_trip(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "wal.log")
            want = [
                put("order:1", "pending"),
                put("order:2", ""),
                delete("order:1"),
                Record(kind=Kind.VALUE, key=b"bin\x00key", value=b"\xff\x00\x01"),
                put("big", "x" * 100_000),
            ]
            write_log(path, *want)
            got, good = replay_all(path)
            same_records(self, got, want)
            self.assertEqual(good, os.path.getsize(path))

    def test_missing_file_is_empty(self):
        with tempfile.TemporaryDirectory() as tmp:
            got, good = replay_all(os.path.join(tmp, "nope.log"))
            self.assertEqual((len(got), good), (0, 0))

    def test_append_is_not_buffered(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "wal.log")
            w = create(path, SyncMode.NEVER)
            try:
                w.append(put("a", "1"))
                # Without close: the record must already be in the file.
                got, _ = replay_all(path)
                same_records(self, got, [put("a", "1")])
                self.assertEqual(w.size(), len(encode(bytearray(), put("a", "1"))))
            finally:
                w.close()

    def test_torn_tail_at_every_byte(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "wal.log")
            first = [put("a", "1"), delete("b")]
            last = put("c", "the last write, cut short")
            write_log(path, *first, last)
            with open(path, "rb") as f:
                full = f.read()
            encoded_last = bytes(encode(bytearray(), last))
            keep = len(full) - len(encoded_last)

            for cut in range(1, len(encoded_last)):
                torn = os.path.join(tmp, f"torn-{cut}.log")
                with open(torn, "wb") as f:
                    f.write(full[: len(full) - cut])
                got, good = replay_all(torn)
                self.assertEqual(
                    len(got),
                    len(first),
                    f"cut {cut} bytes off the last record: replayed {len(got)}, want {len(first)}",
                )
                same_records(self, got, first)
                self.assertEqual(
                    good,
                    keep,
                    f"cut {cut} bytes: good = {good}, want {keep}",
                )

    def test_checksum_mismatch_stops_replay(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "wal.log")
            write_log(path, put("a", "1"), put("b", "2"), put("c", "3"))
            with open(path, "rb") as f:
                data = bytearray(f.read())
            data[-1] ^= 0xFF
            with open(path, "wb") as f:
                f.write(data)
            got, _ = replay_all(path)
            same_records(self, got, [put("a", "1"), put("b", "2")])

    def test_huge_length_is_a_torn_tail(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "wal.log")
            write_log(path, put("a", "1"))
            with open(path, "rb") as f:
                data = f.read()
            garbage = bytearray(HEADER_SIZE)
            struct.pack_into("<I", garbage, 4, 0xFFFFFFF0)
            with open(path, "wb") as f:
                f.write(data + garbage)
            got, good = replay_all(path)
            same_records(self, got, [put("a", "1")])
            self.assertEqual(good, len(data))

    def test_replay_stops_on_callback_error(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "wal.log")
            write_log(path, put("a", "1"), put("b", "2"))
            calls = 0

            def boom(_r: Record) -> None:
                nonlocal calls
                calls += 1
                raise RuntimeError("boom")

            with self.assertRaises(RuntimeError):
                replay(path, boom)
            self.assertEqual(calls, 1)


if __name__ == "__main__":
    unittest.main()
