"""Chapter 5 acceptance tests: the whole store, end to end."""

from __future__ import annotations

import sys
import tempfile
import threading
import time
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from raftkv import kv
from raftkv.kv import (
    ERR_NOT_LEADER,
    ExecuteArgs,
    Op,
    OpGet,
    OpPut,
    StartCluster,
)


def wait_leader(c: kv.Cluster, timeout: float = 5.0) -> int:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        leader, ok = c.Leader()
        if ok:
            return leader
        time.sleep(0.010)
    raise AssertionError("no leader after timeout")


class TestKV(unittest.TestCase):
    def setUp(self) -> None:
        self.c = StartCluster(3)
        self.addCleanup(self.c.Shutdown)

    def test_put_get_delete(self) -> None:
        ck = self.c.NewClerk()
        self.assertFalse(ck.get(b"missing")[1])
        ck.put(b"lang", b"python")
        v, ok = ck.get(b"lang")
        self.assertTrue(ok)
        self.assertEqual(v, b"python")
        ck.put(b"lang", b"rust")
        self.assertEqual(ck.get(b"lang")[0], b"rust")
        ck.delete(b"lang")
        self.assertFalse(ck.get(b"lang")[1])

    def test_follower_redirects_to_leader(self) -> None:
        leader = wait_leader(self.c)
        self.c.NewClerk().put(b"warm", b"up")
        follower = (leader + 1) % 3
        reply = self.c.Server(follower).execute(
            ExecuteArgs(
                op=Op(kind=OpPut, key=b"k", value=b"v", client_id=900, seq=1)
            )
        )
        self.assertEqual(reply.err, ERR_NOT_LEADER)
        self.assertEqual(reply.leader, leader)
        self.assertFalse(self.c.NewClerk().get(b"k")[1])

    def test_leader_failover(self) -> None:
        ck = self.c.NewClerk()
        ck.put(b"before", b"1")
        old = wait_leader(self.c)
        self.c.Crash(old)
        ck.put(b"during", b"2")
        v, ok = ck.get(b"before")
        self.assertTrue(ok)
        self.assertEqual(v, b"1")
        self.c.Restart(old)
        ck.put(b"after", b"3")
        for k in (b"before", b"during", b"after"):
            self.assertTrue(ck.get(k)[1])

    def test_minority_leader_cannot_commit_or_serve_reads(self) -> None:
        c = StartCluster(5)
        self.addCleanup(c.Shutdown)
        ck = c.NewClerk()
        ck.put(b"k", b"old")
        stale = wait_leader(c)
        buddy = (stale + 1) % 5
        majority = [i for i in range(5) if i not in (stale, buddy)]
        c.Partition([stale, buddy], majority)
        w = c.Server(stale).execute(
            ExecuteArgs(
                op=Op(kind=OpPut, key=b"k", value=b"minority", client_id=901, seq=1)
            )
        )
        self.assertNotEqual(w.err, "")
        r = c.Server(stale).execute(
            ExecuteArgs(op=Op(kind=OpGet, key=b"k", client_id=901, seq=2))
        )
        self.assertNotEqual(r.err, "")
        ck.put(b"k", b"majority")
        c.Heal()
        wait_leader(c)
        self.assertEqual(ck.get(b"k")[0], b"majority")

    def test_duplicate_requests_apply_once(self) -> None:
        leader = wait_leader(self.c)
        op = Op(kind=OpPut, key=b"k", value=b"v", client_id=42, seq=1)
        for _ in range(3):
            reply = self.c.Server(leader).execute(ExecuteArgs(op=op))
            self.assertEqual(reply.err, "")
        ck = self.c.NewClerk()
        self.assertEqual(ck.get(b"k")[0], b"v")
        op2 = Op(kind=OpPut, key=b"k", value=b"other", client_id=42, seq=1)
        self.c.Server(leader).execute(ExecuteArgs(op=op2))
        self.assertEqual(ck.get(b"k")[0], b"v")

    def test_concurrent_clients_lossy(self) -> None:
        c = StartCluster(5, kv.WithSeed(7))
        self.addCleanup(c.Shutdown)
        wait_leader(c)
        c.Net().set_unreliable(0.1, 0.1)
        errors: list[BaseException] = []

        def worker(cid: int) -> None:
            try:
                ck = c.NewClerk()
                for i in range(8):
                    k = f"c{cid}-{i}".encode()
                    ck.put(k, b"x")
                    v, ok = ck.get(k)
                    self.assertTrue(ok)
                    self.assertEqual(v, b"x")
            except BaseException as e:
                errors.append(e)

        threads = [threading.Thread(target=worker, args=(i,)) for i in range(4)]
        for t in threads:
            t.start()
        for t in threads:
            t.join(timeout=60)
        self.assertEqual(errors, [])
        c.Net().set_unreliable(0, 0)

    def test_whole_cluster_restart(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            c = StartCluster(3, kv.WithDir(tmp))
            self.addCleanup(c.Shutdown)
            ck = c.NewClerk()
            ck.put(b"persist", b"yes")
            for i in range(3):
                c.Crash(i)
            for i in range(3):
                c.Restart(i)
            wait_leader(c)
            ck2 = c.NewClerk()
            v, ok = ck2.get(b"persist")
            self.assertTrue(ok)
            self.assertEqual(v, b"yes")


if __name__ == "__main__":
    unittest.main()
