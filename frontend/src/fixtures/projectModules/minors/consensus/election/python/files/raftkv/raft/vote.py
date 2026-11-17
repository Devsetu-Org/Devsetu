"""RequestVote handler. TODO 1.2, 1.3."""

from __future__ import annotations

from .rpc import RequestVoteArgs, RequestVoteReply


class VoteMixin:
    def request_vote(self, args: RequestVoteArgs) -> RequestVoteReply:
        """RPC handler a candidate calls to ask for our vote."""
        # ── TODO(1.3) — decide a vote ──────────────────────────────────────────
        raise NotImplementedError(
            "TODO(1.3): request_vote — grant at most one vote per term"
        )
    def log_up_to_date(self, last_term: int, last_index: int) -> bool:
        """Whether a candidate whose last entry is (last_term, last_index) is
        at least as up to date as ours. mu held.
        """
        # ── TODO(1.2) — the election restriction ───────────────────────────────
        raise NotImplementedError(
            "TODO(1.2): log_up_to_date — later last term wins, then longer log"
        )
