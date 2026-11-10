"""labrpc acceptance tests."""

from __future__ import annotations

import sys
import threading
import time
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from raftkv.labrpc import Network, decode, encode


class Echo:
    def __init__(self) -> None:
        self.calls = 0
        self._mu = threading.Lock()

    def handle(self, method: str, args: bytes) -> bytes:
        with self._mu:
            self.calls += 1
        m = decode(args)
        m["n"] = m.get("n", 0) + 1
        return encode(m)


class TestLabRPC(unittest.TestCase):
    def test_call_round_trip(self) -> None:
        net = Network(1)
        net.add(1, Echo())
        ok, r = net.end(0, 1).call("echo", {"n": 41})
        self.assertTrue(ok)
        self.assertEqual(r["n"], 42)

    def test_disconnect_and_partition(self) -> None:
        net = Network(1)
        for i in range(3):
            net.add(i, Echo())
        net.disconnect(2)
        ok, _ = net.end(0, 2).call("echo", {})
        self.assertFalse(ok)
        net.heal()
        net.partition([0, 1], [2])
        ok, _ = net.end(0, 2).call("echo", {})
        self.assertFalse(ok)
        ok, _ = net.end(0, 1).call("echo", {})
        self.assertTrue(ok)
        net.remove(1)
        ok, _ = net.end(0, 1).call("echo", {})
        self.assertFalse(ok)

    def test_closed_end_fails(self) -> None:
        net = Network(1)
        net.add(1, Echo())
        end = net.end(0, 1)
        end.close()
        ok, _ = end.call("echo", {})
        self.assertFalse(ok)

    def test_drop_and_duplicate(self) -> None:
        net = Network(7)
        h = Echo()
        net.add(1, h)
        net.set_unreliable(0.5, 0)
        ok_n = 0
        for _ in range(80):
            ok, _ = net.end(0, 1).call("echo", {})
            if ok:
                ok_n += 1
        self.assertNotEqual(ok_n, 0)
        self.assertNotEqual(ok_n, 80)
        net.set_unreliable(0, 1)
        before = h.calls
        for _ in range(20):
            net.end(0, 1).call("echo", {})
        time.sleep(0.020)
        self.assertEqual(h.calls - before, 40)


if __name__ == "__main__":
    unittest.main()
