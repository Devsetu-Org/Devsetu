"""Election: terms, candidates, leaders. TODO 1.1, 1.4, 1.5."""

from __future__ import annotations

import threading

from .rpc import RequestVoteArgs, RequestVoteReply
from .types import CANDIDATE, FOLLOWER, LEADER


class ElectionMixin:
    def become_follower(self, term: int) -> None:
        """Step down to follower. If term is newer, adopt it and forget the vote.

        mu held.
        """
        # ── TODO(1.1) — a higher term always wins ──────────────────────────────
        #
        # Set self.role to FOLLOWER.
        #
        # Only if term > self.current_term: adopt it (self.current_term = term),
        # clear the vote (self.voted_for = -1) and the leader hint
        # (self.leader_id = -1), then self.persist().
        #
        # A call with the same term must keep voted_for. A candidate that loses
        # to a leader of its own term steps down through here, and it already
        # voted for itself.
        raise NotImplementedError(
            "TODO(1.1): become_follower — adopt the newer term, clear the vote"
        )

    def start_election(self) -> None:
        """Become a candidate for a new term and ask every peer for a vote.

        Returns right away; replies are counted by threads that finish later.
        mu held.
        """
        # ── TODO(1.4) — campaign ───────────────────────────────────────────────
        #
        #  1. self.role = CANDIDATE, self.current_term += 1, vote for ourselves
        #     (self.voted_for = self.me), self.leader_id = -1, self.persist(),
        #     and self.reset_election_timer().
        #  2. Remember the term in a local variable and build one RequestVoteArgs
        #     from it and our last log entry.
        #  3. Keep a vote tally in a local `votes = 1` (our own). If that already
        #     makes a majority (a one-node cluster), self.become_leader() and
        #     return.
        #  4. For every peer except ourselves, start a thread that calls
        #     self.send_request_vote WITHOUT holding the lock, and on success
        #     takes the lock and calls self.handle_vote_reply(term, reply, votes).
        #
        # The threads share `votes` and `args`; votes is only touched with mu
        # held, args is only read. Put votes in a one-element list so closures
        # can mutate it: votes = [1].
        raise NotImplementedError(
            "TODO(1.4): start_election — new term, vote for self, ask everyone"
        )

    def handle_vote_reply(
        self, term: int, reply: RequestVoteReply, votes: list[int]
    ) -> None:
        """Count one reply to the election that began in term. mu held.

        votes is a one-element list holding the running tally.
        """
        # ── TODO(1.5) — count votes, ignore stale ones ─────────────────────────
        #
        #  1. If reply.term > self.current_term: become_follower(reply.term), return.
        #  2. A reply can arrive long after its election. Ignore it unless we are
        #     still a CANDIDATE AND self.current_term == term.
        #  3. If the vote was granted, votes[0] += 1; at self.majority() call
        #     self.become_leader().
        raise NotImplementedError(
            "TODO(1.5): handle_vote_reply — count only fresh, granted votes"
        )

    def become_leader(self) -> None:
        """Take over for the current term and announce it immediately. mu held."""
        # ── TODO(1.5) — win ────────────────────────────────────────────────────
        #
        # Set self.role = LEADER and self.leader_id = self.me, reset the leader's
        # per-follower progress with self.reset_leader_progress(), and send the
        # first heartbeat right away with self.broadcast_append().
        raise NotImplementedError(
            "TODO(1.5): become_leader — take the job and announce it"
        )
