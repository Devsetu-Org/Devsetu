"""RequestVote handler. TODO 1.2, 1.3."""

from __future__ import annotations

from .rpc import RequestVoteArgs, RequestVoteReply


class VoteMixin:
    def request_vote(self, args: RequestVoteArgs) -> RequestVoteReply:
        """RPC handler a candidate calls to ask for our vote."""
        # ── TODO(1.3) — decide a vote ──────────────────────────────────────────
        #
        # Take the lock (with self.mu), then:
        #
        #  1. If args.term is newer than ours, become_follower(args.term) first,
        #     so the rest is decided in the candidate's term.
        #  2. Build a reply with reply.term = self.current_term and
        #     reply.vote_granted = False.
        #  3. If args.term is older than ours, refuse (return the reply).
        #  4. Grant the vote only if we have not voted this term, or already voted
        #     for this very candidate (its first reply may have been lost), and
        #     log_up_to_date says its log is at least as good as ours.
        #  5. On a grant: set self.voted_for, call self.persist(), call
        #     self.reset_election_timer(), and set reply.vote_granted.
        #
        # Do not reset the election timer when you refuse: a candidate we reject
        # must not be able to keep us from ever campaigning.
        raise NotImplementedError(
            "TODO(1.3): request_vote — grant at most one vote per term"
        )

    def log_up_to_date(self, last_term: int, last_index: int) -> bool:
        """Whether a candidate whose last entry is (last_term, last_index) is
        at least as up to date as ours. mu held.
        """
        # ── TODO(1.2) — the election restriction ───────────────────────────────
        #
        # Compare last log terms first: the later term is more up to date. If the
        # terms are equal, the longer log is. Equal logs are up to date.
        #
        # Use self.last_log_term() and self.last_log_index().
        raise NotImplementedError(
            "TODO(1.2): log_up_to_date — later last term wins, then longer log"
        )
