"""Chapter 4 acceptance tests: crash, restart, and safety."""

from __future__ import annotations

import sys
import tempfile
import time
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from raftkv import labharness, raft, storage


class TestPersistence(unittest.TestCase):
    def test_vote_survives_restart(self) -> None:
        c = labharness.Cluster(self, 3, labharness.Manual())

        def ask(term: int, candidate: int) -> raft.RequestVoteReply:
            return c.Raft(0).request_vote(
                raft.RequestVoteArgs(term=term, candidate_id=candidate)
            )

        self.assertTrue(ask(5, 1).vote_granted)
        c.Crash(0)
        c.Restart(0)
        st = c.State(0)
        self.assertEqual(st.term, 5)
        self.assertEqual(st.voted_for, 1)
        self.assertFalse(ask(5, 2).vote_granted)
        self.assertTrue(ask(5, 1).vote_granted)

    def test_term_survives_restart(self) -> None:
        c = labharness.Cluster(self, 3)
        c.CheckOneLeader()
        c.Submit("t", 3)
        before = [c.State(i).term for i in range(3)]
        for i in range(3):
            c.Crash(i)
        for i in range(3):
            c.Restart(i)
            self.assertGreaterEqual(c.State(i).term, before[i])

    def test_log_survives_full_restart(self) -> None:
        c = labharness.Cluster(self, 3)
        c.CheckOneLeader()
        want = []
        for i in range(1, 6):
            cmd = f"keep-{i}"
            c.Submit(cmd, 3)
            want.append(cmd)
        c.WaitLogs(5)
        for i in range(3):
            c.Crash(i)
        for i in range(3):
            c.Restart(i)
        for i in range(3):
            self.assertEqual(c.LogCommands(i), want)
        c.CheckOneLeader()
        idx = c.Submit("after-restart", 3)
        self.assertEqual(idx, 6)
        c.Eventually(
            5.0,
            "every node to re-apply all 6 entries",
            lambda: all(c.Applied(i) == 6 for i in range(3)),
        )

    def test_restarted_leader_catches_up(self) -> None:
        c = labharness.Cluster(self, 3)
        leader = c.CheckOneLeader()
        c.Submit("one", 3)
        c.Submit("two", 3)
        c.Crash(leader)
        c.Submit("three", 2)
        c.Restart(leader)
        c.Submit("four", 3)
        self.assertEqual(c.WaitLogs(4), ["one", "two", "three", "four"])

    def test_cluster_on_file_store(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            def stores(i: int):
                return storage.File(str(Path(tmp) / f"node-{i}"))

            c = labharness.Cluster(self, 3, labharness.WithStores(stores))
            c.CheckOneLeader()
            c.Submit("on-disk", 3)
            for i in range(3):
                c.Crash(i)
            for i in range(3):
                c.Restart(i)
            self.assertEqual(c.WaitLogs(1), ["on-disk"])
            c.CheckOneLeader()
            c.Submit("again", 3)


class TestFileStore(unittest.TestCase):
    def test_file_missing_is_empty(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            f = storage.File(tmp)
            self.assertIsNone(f.load())

    def test_file_save_then_load(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            f = storage.File(tmp)
            f.save(b"term=3")
            g = storage.File(tmp)
            self.assertEqual(g.load(), b"term=3")

    def test_file_save_replaces_and_leaves_no_temp(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            f = storage.File(tmp)
            f.save(b"a-long-first-value")
            f.save(b"b")
            self.assertEqual(f.load(), b"b")
            names = list(Path(tmp).iterdir())
            self.assertEqual(len(names), 1)

    def test_file_stale_temp_does_not_matter(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            f = storage.File(tmp)
            f.save(b"good")
            (Path(tmp) / f"{storage.FILE_NAME}.tmp").write_bytes(b"go")
            self.assertEqual(f.load(), b"good")
            f.save(b"better")
            self.assertEqual(f.load(), b"better")


if __name__ == "__main__":
    unittest.main()
