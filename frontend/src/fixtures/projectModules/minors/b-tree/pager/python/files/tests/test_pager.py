"""Acceptance tests for the pager."""

from __future__ import annotations

import os
import struct
import tempfile
import unittest

from btreekv.pager import (
    PAGE_SIZE,
    USABLE,
    ErrBadPage,
    ErrChecksum,
    Pager,
)
from btreekv.pager.page import crc32c


def _page(b: int) -> bytearray:
    buf = bytearray(PAGE_SIZE)
    for i in range(USABLE):
        buf[i] = b
    return buf


class PagerTest(unittest.TestCase):
    def setUp(self) -> None:
        self._tmpdir = tempfile.TemporaryDirectory()
        self.path = os.path.join(self._tmpdir.name, "data.db")

    def tearDown(self) -> None:
        self._tmpdir.cleanup()

    def open_pager(self) -> Pager:
        return Pager.open(self.path)

    def test_write_then_read(self) -> None:
        p = self.open_pager()
        try:
            for i in range(1, 4):
                p.write_page(i, _page(i))
            for i in range(1, 4):
                got = bytearray(PAGE_SIZE)
                p.read_page(i, got)
                self.assertEqual(got[:USABLE], _page(i)[:USABLE])
        finally:
            p.close()

    def test_page_trailer_is_crc32c(self) -> None:
        p = self.open_pager()
        try:
            p.write_page(2, _page(0xAB))
        finally:
            p.close()
        with open(self.path, "rb") as f:
            raw = f.read()
        self.assertGreaterEqual(len(raw), 3 * PAGE_SIZE)
        pg = raw[2 * PAGE_SIZE : 3 * PAGE_SIZE]
        want = crc32c(pg[:USABLE])
        got = struct.unpack_from("<I", pg, USABLE)[0]
        self.assertEqual(got, want)

    def test_write_leaves_caller_buffer_alone(self) -> None:
        p = self.open_pager()
        try:
            buf = _page(7)
            for i in range(USABLE, PAGE_SIZE):
                buf[i] = 0xEE
            p.write_page(1, buf)
            for i in range(USABLE, PAGE_SIZE):
                self.assertEqual(buf[i], 0xEE)
        finally:
            p.close()

    def test_corruption_is_detected(self) -> None:
        p = self.open_pager()
        try:
            p.write_page(1, _page(1))
            fd = os.open(self.path, os.O_RDWR)
            try:
                os.pwrite(fd, b"\xff", PAGE_SIZE + 100)
            finally:
                os.close(fd)
            with self.assertRaises(ErrChecksum):
                p.read_page(1, bytearray(PAGE_SIZE))
        finally:
            p.close()

    def test_bad_buffer_and_past_end(self) -> None:
        p = self.open_pager()
        try:
            with self.assertRaises(ErrBadPage):
                p.write_page(1, bytearray(100))
            with self.assertRaises(ErrBadPage):
                p.read_page(1, bytearray(100))
            with self.assertRaises(ErrBadPage):
                p.read_page(500, bytearray(PAGE_SIZE))
        finally:
            p.close()

    def test_allocate_grows_the_file(self) -> None:
        p = self.open_pager()
        try:
            for want in range(1, 5):
                got = p.allocate()
                self.assertEqual(got, want)
            self.assertEqual(p.meta().page_count, 5)
            p.read_page(4, bytearray(PAGE_SIZE))
        finally:
            p.close()

    def test_free_then_allocate_reuses(self) -> None:
        p = self.open_pager()
        try:
            nos = [p.allocate() for _ in range(3)]
            p.free(nos[1])
            p.free(nos[2])
            for want in (nos[2], nos[1], 4):
                self.assertEqual(p.allocate(), want)
            m = p.meta()
            self.assertEqual(m.page_count, 5)
            self.assertEqual(m.free_head, 0)
        finally:
            p.close()

    def test_free_rejects_bad_pages(self) -> None:
        p = self.open_pager()
        try:
            p.allocate()
            for no in (0, 9):
                with self.assertRaises(ErrBadPage):
                    p.free(no)
        finally:
            p.close()

    def test_state_survives_reopen(self) -> None:
        p = self.open_pager()
        a = p.allocate()
        b = p.allocate()
        c = p.allocate()
        p.write_page(c, _page(9))
        p.free(b)
        p.set_root(a)
        p.close()

        p = self.open_pager()
        try:
            self.assertEqual(p.root(), a)
            got = bytearray(PAGE_SIZE)
            p.read_page(c, got)
            self.assertEqual(got[0], 9)
            self.assertEqual(p.allocate(), b)
            self.assertEqual(p.allocate(), 4)
        finally:
            p.close()

    def test_open_rejects_a_foreign_file(self) -> None:
        with open(self.path, "wb") as f:
            f.write(b"not a page file " * (PAGE_SIZE // 16))
        with self.assertRaises(Exception):
            Pager.open(self.path)

    def test_open_rejects_a_corrupt_header(self) -> None:
        p = self.open_pager()
        p.close()
        fd = os.open(self.path, os.O_RDWR)
        try:
            os.pwrite(fd, b"\x55", 3)
        finally:
            os.close(fd)
        with self.assertRaises(ErrChecksum):
            Pager.open(self.path)


if __name__ == "__main__":
    unittest.main()
