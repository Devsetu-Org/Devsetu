"""Chapter 2 acceptance tests: AppendEntries and log repair."""

from __future__ import annotations

import sys
import time
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from raftkv import labharness, raft


def entries(*terms: int) -> list[raft.LogEntry]:
    return [
        raft.LogEntry(term=t, command=f"e{i + 1}".encode())
        for i, t in enumerate(terms)
    ]


class TestReplication(unittest.TestCase):
    def test_basic_append(self) -> None:
        c = labharness.Cluster(self, 3)
        c.CheckOneLeader()
        for want in range(1, 6):
            idx, _ = c.Start(f"cmd-{want}")
            self.assertEqual(idx, want)
        log = c.WaitLogs(5)
        self.assertEqual(log, [f"cmd-{i}" for i in range(1, 6)])

    def test_start_on_follower_is_rejected(self) -> None:
        c = labharness.Cluster(self, 3)
        leader = c.CheckOneLeader()
        follower = (leader + 1) % 3
        _, _, ok = c.Raft(follower).start(b"x")
        self.assertFalse(ok)
        time.sleep(0.100)
        for i in range(3):
            self.assertEqual(len(c.State(i).log), 0)

    def test_append_entries_consistency_check(self) -> None:
        c = labharness.Cluster(self, 3, labharness.Manual())
        rf = c.Raft(0)
        rf.debug_seed(2, entries(1, 2, 2, 2))

        def call(args: raft.AppendEntriesArgs) -> raft.AppendEntriesReply:
            return rf.append_entries(args)

        r = call(raft.AppendEntriesArgs(term=1, leader_id=1))
        self.assertFalse(r.success)
        self.assertEqual(r.term, 2)

        r = call(
            raft.AppendEntriesArgs(term=2, leader_id=1, prev_log_index=9, prev_log_term=2)
        )
        self.assertFalse(r.success)
        self.assertEqual(r.conflict_index, 5)

        r = call(
            raft.AppendEntriesArgs(term=2, leader_id=1, prev_log_index=4, prev_log_term=3)
        )
        self.assertFalse(r.success)
        self.assertEqual(r.conflict_index, 2)
        self.assertEqual(len(c.State(0).log), 4)

        r = call(
            raft.AppendEntriesArgs(
                term=2,
                leader_id=1,
                prev_log_index=4,
                prev_log_term=2,
                entries=[raft.LogEntry(term=2, command=b"e5")],
            )
        )
        self.assertTrue(r.success)
        self.assertEqual(len(c.State(0).log), 5)

    def test_append_entries_keeps_matching_suffix(self) -> None:
        c = labharness.Cluster(self, 3, labharness.Manual())
        rf = c.Raft(0)
        rf.debug_seed(2, entries(1, 1, 2, 2, 2))
        reply = rf.append_entries(
            raft.AppendEntriesArgs(
                term=2, leader_id=1, prev_log_index=0, entries=entries(1, 1)
            )
        )
        self.assertTrue(reply.success)
        self.assertEqual(len(c.State(0).log), 5)

        reply = rf.append_entries(
            raft.AppendEntriesArgs(
                term=3,
                leader_id=1,
                prev_log_index=2,
                prev_log_term=1,
                entries=[raft.LogEntry(term=3, command=b"new")],
            )
        )
        st = c.State(0)
        self.assertTrue(reply.success)
        self.assertEqual(len(st.log), 3)
        self.assertEqual(st.log[2].term, 3)
        self.assertEqual(st.log[2].command, b"new")

    def test_follower_catches_up(self) -> None:
        c = labharness.Cluster(self, 3)
        leader = c.CheckOneLeader()
        lag = (leader + 1) % 3
        c.Start("a")
        c.Start("b")
        c.WaitLogs(2)
        c.Disconnect(lag)
        for cmd in ("c", "d", "e"):
            c.Start(cmd)
        c.WaitLogs(5, leader, (leader + 2) % 3)
        self.assertEqual(len(c.State(lag).log), 2)
        c.Connect(lag)
        self.assertEqual(c.WaitLogs(5), ["a", "b", "c", "d", "e"])

    def test_conflicting_entries_are_replaced(self) -> None:
        c = labharness.Cluster(self, 3, labharness.Manual())
        c.Campaign(0)
        c.Eventually(2.0, "node 0 to win", lambda: c.State(0).role == raft.LEADER)
        c.Partition([0], [1, 2])
        for cmd in ("x1", "x2", "x3"):
            ok = c.Raft(0).start(cmd.encode())[2]
            self.assertTrue(ok)
        c.Campaign(1)
        c.Eventually(2.0, "node 1 to win", lambda: c.State(1).role == raft.LEADER)
        c.Raft(1).start(b"y1")
        c.Raft(1).start(b"y2")
        c.WaitLogs(2, 1, 2)
        c.Heal()
        self.assertEqual(c.WaitLogs(2), ["y1", "y2"])

    def test_append_under_lossy_network(self) -> None:
        c = labharness.Cluster(self, 5, labharness.WithSeed(9))
        c.CheckOneLeader()
        c.Net().set_unreliable(0.15, 0.25)
        c.Net().set_delay(0, 0.010)
        for i in range(15):
            c.Start(f"n{i}")
            time.sleep(0.015)
        c.Net().set_unreliable(0, 0)
        c.Net().set_delay(0, 0)
        c.CheckOneLeader()
        log: list[str] = []

        def converged() -> bool:
            nonlocal log
            log = c.LogCommands(0)
            for i in range(1, 5):
                if c.LogCommands(i) != log:
                    return False
            return len(log) > 0

        c.Eventually(8.0, "all logs to converge", converged)
        self.assertEqual(len(log), len(set(log)))


if __name__ == "__main__":
    unittest.main()
