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
        raise NotImplementedError(
            "TODO(1.1): become_follower — adopt the newer term, clear the vote"
        )
    def start_election(self) -> None:
        """Become a candidate for a new term and ask every peer for a vote.

        Returns right away; replies are counted by threads that finish later.
        mu held.
        """
        # ── TODO(1.4) — campaign ───────────────────────────────────────────────
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
        raise NotImplementedError(
            "TODO(1.5): handle_vote_reply — count only fresh, granted votes"
        )
    def become_leader(self) -> None:
        """Take over for the current term and announce it immediately. mu held."""
        # ── TODO(1.5) — win ────────────────────────────────────────────────────
        raise NotImplementedError(
            "TODO(1.5): become_leader — take the job and announce it"
        )
