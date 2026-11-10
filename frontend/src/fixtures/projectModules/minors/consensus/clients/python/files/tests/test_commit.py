"""Chapter 3 acceptance tests: what commits, when, and what gets applied."""

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


class TestCommit(unittest.TestCase):
    def test_commit_and_apply(self) -> None:
        c = labharness.Cluster(self, 3)
        c.CheckOneLeader()
        for want in range(1, 6):
            idx = c.Submit(f"op-{want}", 3)
            self.assertEqual(idx, want)
        c.Eventually(
            3.0,
            "every server to apply 5 entries",
            lambda: all(c.Applied(i) == 5 for i in range(3)),
        )

    def test_apply_is_exactly_once_under_duplicates(self) -> None:
        c = labharness.Cluster(self, 3, labharness.WithSeed(5))
        c.CheckOneLeader()
        c.Net().set_unreliable(0.05, 0.5)
        for i in range(1, 11):
            c.Submit(f"dup-{i}", 3)
        c.Net().set_unreliable(0, 0)
        time.sleep(0.200)
        for i in range(3):
            self.assertEqual(c.Applied(i), 10)

    def test_no_commit_without_majority(self) -> None:
        c = labharness.Cluster(self, 5)
        leader = c.CheckOneLeader()
        others = [i for i in range(5) if i != leader]
        c.Disconnect(others[1])
        c.Disconnect(others[2])
        c.Disconnect(others[3])
        ok = c.Raft(leader).start(b"lonely")[2]
        if not ok:
            self.skipTest("leader changed under us; nothing to check")
        time.sleep(0.800)
        self.assertEqual(c.CommittedCount(), 0)
        self.assertEqual(c.State(leader).commit_index, 0)
        c.Heal()
        c.CheckOneLeader()
        c.Submit("after-heal", 5)

    def test_commits_with_minority_down(self) -> None:
        c = labharness.Cluster(self, 5)
        leader = c.CheckOneLeader()
        c.Disconnect((leader + 1) % 5)
        c.Disconnect((leader + 2) % 5)
        for i in range(3):
            c.Submit(f"m{i}", 3)

    def test_commit_rule_needs_current_term(self) -> None:
        c = labharness.Cluster(self, 5, labharness.Manual())
        for i in range(5):
            if i < 2:
                c.Raft(i).debug_seed(1, [raft.LogEntry(term=1, command=b"old")])
            else:
                c.Raft(i).debug_seed(1, [])
        c.Campaign(1)
        c.Eventually(2.0, "node 1 to win", lambda: c.State(1).role == raft.LEADER)
        c.WaitLogs(1)
        time.sleep(0.500)
        for i in range(5):
            self.assertEqual(c.State(i).commit_index, 0)
        idx, _, ok = c.Raft(1).start(b"new")
        self.assertTrue(ok)
        self.assertEqual(idx, 2)
        c.Eventually(
            3.0,
            "both entries to commit everywhere",
            lambda: c.CountApplied(2, "new") == 5 and c.CountApplied(1, "old") == 5,
        )

    def test_follower_commit_is_bounded_by_verified_entries(self) -> None:
        c = labharness.Cluster(self, 3, labharness.Manual())
        rf = c.Raft(0)
        rf.debug_seed(2, entries(1, 1, 2, 2, 2))
        reply = rf.append_entries(
            raft.AppendEntriesArgs(term=2, leader_id=1, prev_log_index=0, leader_commit=4)
        )
        st = c.State(0)
        self.assertTrue(reply.success)
        self.assertEqual(st.commit_index, 0)
        reply = rf.append_entries(
            raft.AppendEntriesArgs(
                term=2, leader_id=1, prev_log_index=2, prev_log_term=1, entries=[], leader_commit=9
            )
        )
        st = c.State(0)
        self.assertTrue(reply.success)
        self.assertEqual(st.commit_index, 2)
        c.Eventually(2.0, "node 0 to apply the committed prefix", lambda: c.Applied(0) == 2)
        rf.append_entries(
            raft.AppendEntriesArgs(term=2, leader_id=1, prev_log_index=0, leader_commit=0)
        )
        self.assertEqual(c.State(0).commit_index, 2)

    def test_uncommitted_entries_are_overwritten(self) -> None:
        c = labharness.Cluster(self, 3, labharness.Manual())
        c.Campaign(0)
        c.Eventually(2.0, "node 0 to win", lambda: c.State(0).role == raft.LEADER)
        c.Partition([0], [1, 2])
        c.Raft(0).start(b"x1")
        c.Raft(0).start(b"x2")
        time.sleep(0.200)
        self.assertEqual(c.CommittedCount(), 0)
        c.Campaign(1)
        c.Eventually(2.0, "node 1 to win", lambda: c.State(1).role == raft.LEADER)
        c.Raft(1).start(b"y1")
        c.Eventually(3.0, "y1 to commit on the majority side", lambda: c.CountApplied(1, "y1") >= 2)
        c.Heal()
        c.Eventually(
            5.0,
            "node 0 to adopt the committed history",
            lambda: (lambda cmd, ok: ok and cmd == "y1")(*c.AppliedCommand(0, 1)),
        )
        self.assertEqual(c.LogCommands(0), ["y1"])
        _, ok = c.Committed(2)
        self.assertFalse(ok)

    def test_committed_entries_survive_leader_changes(self) -> None:
        c = labharness.Cluster(self, 5, labharness.WithSeed(11))
        committed: dict[int, str] = {}
        for round_ in range(6):
            cmd = f"round-{round_}"
            committed[c.Submit(cmd, 3)] = cmd
            leader = c.CheckOneLeader()
            c.Disconnect(leader)
            cmd = f"round-{round_}-b"
            committed[c.Submit(cmd, 3)] = cmd
            c.Connect(leader)
        c.Heal()
        final = c.Submit("final", 5)
        committed[final] = "final"
        for idx, cmd in committed.items():
            got, ok = c.Committed(idx)
            self.assertTrue(ok)
            self.assertEqual(got, cmd)
        c.Eventually(
            5.0,
            "every server to apply everything",
            lambda: all(c.Applied(i) >= final for i in range(5)),
        )


if __name__ == "__main__":
    unittest.main()
