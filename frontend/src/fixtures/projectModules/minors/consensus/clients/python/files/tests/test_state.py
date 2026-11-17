"""State machine unit tests."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from raftkv.kv import Op, OpDelete, OpGet, OpPut, State


def put(s: State, client: int, seq: int, k: str, v: str) -> None:
    s.apply(Op(kind=OpPut, key=k.encode(), value=v.encode(), client_id=client, seq=seq))


def get(s: State, client: int, seq: int, k: str) -> tuple[str, bool]:
    r = s.apply(Op(kind=OpGet, key=k.encode(), client_id=client, seq=seq))
    return r.value.decode(), r.found


class TestState(unittest.TestCase):
    def test_put_get_delete(self) -> None:
        s = State()
        self.assertFalse(get(s, 1, 1, "a")[1])
        put(s, 1, 2, "a", "1")
        put(s, 1, 3, "a", "2")
        v, ok = get(s, 1, 4, "a")
        self.assertTrue(ok)
        self.assertEqual(v, "2")
        s.apply(Op(kind=OpDelete, key=b"a", client_id=1, seq=5))
        self.assertFalse(get(s, 1, 6, "a")[1])
        s.apply(Op(kind=OpDelete, key=b"never", client_id=1, seq=7))

    def test_empty_value_is_not_missing(self) -> None:
        s = State()
        put(s, 1, 1, "k", "")
        v, ok = get(s, 1, 2, "k")
        self.assertTrue(ok)
        self.assertEqual(v, "")

    def test_ignores_duplicate_writes(self) -> None:
        s = State()
        put(s, 1, 1, "k", "mine")
        put(s, 2, 1, "k", "theirs")
        put(s, 1, 1, "k", "mine")
        self.assertEqual(get(s, 3, 1, "k")[0], "theirs")
        s.apply(Op(kind=OpDelete, key=b"k", client_id=1, seq=2))
        put(s, 2, 2, "k", "again")
        s.apply(Op(kind=OpDelete, key=b"k", client_id=1, seq=2))
        v, ok = get(s, 3, 2, "k")
        self.assertTrue(ok)
        self.assertEqual(v, "again")

    def test_copies_bytes(self) -> None:
        s = State()
        val = bytearray(b"abc")
        s.apply(Op(kind=OpPut, key=b"k", value=bytes(val), client_id=1, seq=1))
        val[0] = ord("X")
        r = s.apply(Op(kind=OpGet, key=b"k", client_id=1, seq=2))
        self.assertEqual(r.value, b"abc")
        r.value = bytearray(r.value)
        r.value[0] = ord("Y")
        r2 = s.apply(Op(kind=OpGet, key=b"k", client_id=1, seq=3))
        self.assertEqual(r2.value, b"abc")


if __name__ == "__main__":
    unittest.main()
