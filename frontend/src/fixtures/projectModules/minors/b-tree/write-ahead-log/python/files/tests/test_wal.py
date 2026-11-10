"""Acceptance tests for the WAL."""

from __future__ import annotations

import os
import struct
import tempfile
import unittest

from btreekv.pager.page import USABLE, crc32c
from btreekv.wal import (
    Kind,
    Record,
    SyncMode,
    append_payload,
    create,
    encode,
    meta_record,
    commit_record,
    replay,
)
from btreekv.wal.meta import unpack_meta
from btreekv.wal.record import HEADER_SIZE


def page_rec(no: int, fill: int) -> Record:
    return Record(kind=Kind.PAGE, page=no, data=bytes([fill]) * USABLE)


class WALTest(unittest.TestCase):
    def test_encode_frame(self) -> None:
        r = Record(kind=Kind.PAGE, page=9, data=b"hello")
        prefix = bytearray(b"keep-me")
        out = encode(prefix, r)
        self.assertTrue(out.startswith(b"keep-me"))
        frame = out[len(b"keep-me") :]
        payload = append_payload(bytearray(), r)
        self.assertEqual(len(frame), HEADER_SIZE + len(payload))
        got = struct.unpack_from("<I", frame, 0)[0]
        self.assertEqual(got, crc32c(payload))
        self.assertEqual(struct.unpack_from("<I", frame, 4)[0], len(payload))
        self.assertEqual(bytes(frame[HEADER_SIZE:]), bytes(payload))

    def test_append_replay_round_trip(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            path = os.path.join(td, "wal.log")
            w = create(path, SyncMode.NEVER)
            w.append(page_rec(1, ord("a")), meta_record(1, 2, 0), commit_record())
            w.append(page_rec(2, ord("b")), commit_record())
            size = w.size()
            w.close()
            recs = []
            ends = []

            def on_rec(r, end):
                recs.append(r)
                ends.append(end)

            good = replay(path, on_rec)
            self.assertEqual(len(recs), 5)
            self.assertEqual(good, size)
            self.assertEqual(ends[-1], size)
            self.assertEqual(recs[0].kind, Kind.PAGE)
            self.assertEqual(recs[0].page, 1)
            self.assertEqual(recs[0].data, page_rec(1, ord("a")).data)
            root, count, free = unpack_meta(recs[1])
            self.assertEqual((root, count, free), (1, 2, 0))
            self.assertEqual(recs[2].kind, Kind.COMMIT)
            self.assertEqual(recs[3].page, 2)

    def test_durable_tracks_fsync(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            w = create(os.path.join(td, "a.log"), SyncMode.ALWAYS)
            w.append(page_rec(1, ord("x")))
            self.assertEqual(w.durable(), w.size())
            self.assertGreater(w.size(), 0)
            w.close()

            w = create(os.path.join(td, "b.log"), SyncMode.NEVER)
            w.append(page_rec(1, ord("x")))
            self.assertEqual(w.durable(), 0)
            w.sync()
            self.assertEqual(w.durable(), w.size())
            w.close()

    def test_torn_tail_is_ignored(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            path = os.path.join(td, "wal.log")
            w = create(path, SyncMode.NEVER)
            w.append(page_rec(1, 1), commit_record())
            good_size = w.size()
            w.append(page_rec(2, 2))
            # Corrupt the last byte of the unfinished batch.
            with open(path, "r+b") as f:
                f.seek(0, os.SEEK_END)
                pos = f.tell() - 1
                f.seek(pos)
                f.write(b"\xff")
            w.close()
            recs = []
            good = replay(path, lambda r, e: recs.append(r))
            self.assertEqual(len(recs), 2)
            self.assertEqual(good, good_size)


if __name__ == "__main__":
    unittest.main()
