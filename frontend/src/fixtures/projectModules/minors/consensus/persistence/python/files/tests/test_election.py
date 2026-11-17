"""Chapter 1 acceptance tests: terms, votes, and leaders."""

from __future__ import annotations

import sys
import time
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from raftkv import labharness, raft


class TestElection(unittest.TestCase):
    def test_initial_election(self) -> None:
        c = labharness.Cluster(self, 3)
        leader = c.CheckOneLeader()
        term, _ = c.Raft(leader).get_state()
        self.assertGreaterEqual(term, 1)
        for i in range(3):
            got, _ = c.Raft(i).get_state()
            self.assertEqual(got, term)
        time.sleep(0.600)
        again = c.CheckOneLeader()
        term2, _ = c.Raft(again).get_state()
        self.assertEqual(again, leader)
        self.assertEqual(term2, term)

    def test_re_election(self) -> None:
        c = labharness.Cluster(self, 3)
        first = c.CheckOneLeader()
        c.Disconnect(first)
        second = c.CheckOneLeader()
        self.assertNotEqual(second, first)

        first_term, _ = c.Raft(first).get_state()
        c.Connect(first)
        c.Eventually(
            3.0,
            "old leader to step down",
            lambda: (lambda t, L: (not L) or t > first_term)(*c.Raft(first).get_state()),
        )
        self.assertEqual(c.CheckOneLeader(), second)

        c.Disconnect(second)
        c.Disconnect((second + 1) % 3)
        c.CheckNoLeader(0.700, (second + 2) % 3)
        c.Connect(second)
        c.CheckOneLeader()

    def test_minority_cannot_win(self) -> None:
        c = labharness.Cluster(self, 5)
        leader = c.CheckOneLeader()
        minority: list[int] = []
        for i in range(5):
            if i != leader and len(minority) < 2:
                minority.append(i)
        majority = [i for i in range(5) if i not in minority]
        start_term, _ = c.Raft(minority[0]).get_state()

        c.Partition(minority, majority)
        c.CheckNoLeader(1.200, *minority)
        for i in minority:
            term, _ = c.Raft(i).get_state()
            self.assertGreater(term, start_term)
        c.CheckOneLeader(*majority)
        c.Heal()
        c.CheckOneLeader()

    def test_one_leader_per_term_under_chaos(self) -> None:
        c = labharness.Cluster(self, 5, labharness.WithSeed(42))
        c.Net().set_unreliable(0.1, 0.1)
        c.Net().set_delay(0, 0.015)
        for round_ in range(12):
            a, b = round_ % 5, (round_ * 2 + 1) % 5
            c.Disconnect(a)
            if b != a:
                c.Disconnect(b)
            time.sleep(0.250)
            c.Connect(a)
            c.Connect(b)
            time.sleep(0.150)
        c.Net().set_unreliable(0, 0)
        c.Net().set_delay(0, 0)
        c.Heal()
        c.CheckOneLeader()

    def test_vote_once_per_term(self) -> None:
        c = labharness.Cluster(self, 3, labharness.Manual())
        rf = c.Raft(0)

        def ask(term: int, candidate: int) -> raft.RequestVoteReply:
            return rf.request_vote(
                raft.RequestVoteArgs(term=term, candidate_id=candidate)
            )

        r = ask(1, 1)
        self.assertTrue(r.vote_granted)
        self.assertEqual(r.term, 1)
        self.assertFalse(ask(1, 2).vote_granted)
        self.assertTrue(ask(1, 1).vote_granted)
        r = ask(2, 2)
        self.assertTrue(r.vote_granted)
        self.assertEqual(r.term, 2)
        r = ask(1, 1)
        self.assertFalse(r.vote_granted)
        self.assertEqual(r.term, 2)

    def test_vote_requires_up_to_date_log(self) -> None:
        c = labharness.Cluster(self, 3, labharness.Manual())
        rf = c.Raft(0)
        rf.debug_seed(
            3,
            [raft.LogEntry(term=1), raft.LogEntry(term=1), raft.LogEntry(term=3)],
        )
        cases = [
            ("older last term, longer log", 4, 9, 2, False),
            ("same last term, shorter log", 5, 2, 3, False),
            ("same last term, same length", 6, 3, 3, True),
            ("newer last term, shorter log", 7, 1, 4, True),
        ]
        for name, term, last_idx, last_term, want in cases:
            reply = rf.request_vote(
                raft.RequestVoteArgs(
                    term=term,
                    candidate_id=1,
                    last_log_index=last_idx,
                    last_log_term=last_term,
                )
            )
            self.assertEqual(reply.vote_granted, want, name)
            self.assertEqual(reply.term, term, name)

    def test_step_down_on_higher_term(self) -> None:
        c = labharness.Cluster(self, 3)
        leader = c.CheckOneLeader()
        term, _ = c.Raft(leader).get_state()
        other = (leader + 1) % 3
        reply = c.Raft(leader).request_vote(
            raft.RequestVoteArgs(term=term + 5, candidate_id=other)
        )
        self.assertTrue(reply.vote_granted)
        got, is_leader = c.Raft(leader).get_state()
        self.assertFalse(is_leader)
        self.assertEqual(got, term + 5)


if __name__ == "__main__":
    unittest.main()
