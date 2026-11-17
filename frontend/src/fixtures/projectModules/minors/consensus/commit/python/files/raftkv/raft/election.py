"""Election: terms, candidates, leaders."""

from __future__ import annotations

import threading

from .rpc import RequestVoteArgs, RequestVoteReply
from .types import CANDIDATE, FOLLOWER, LEADER


class ElectionMixin:
    def become_follower(self, term: int) -> None:
        """Step down to follower. If term is newer, adopt it and forget the vote.

        A same-term call keeps the vote, so a candidate that loses to a leader
        cannot vote twice. mu held.
        """
        self.role = FOLLOWER
        if term > self.current_term:
            self.current_term = term
            self.voted_for = -1
            self.leader_id = -1
            self.persist()

    def start_election(self) -> None:
        """Become a candidate for a new term and ask every peer for a vote.

        Returns right away; replies are counted by threads that finish later.
        mu held.
        """
        self.role = CANDIDATE
        self.current_term += 1
        self.voted_for = self.me
        self.leader_id = -1
        self.persist()
        self.reset_election_timer()

        term = self.current_term
        args = RequestVoteArgs(
            term=term,
            candidate_id=self.me,
            last_log_index=self.last_log_index(),
            last_log_term=self.last_log_term(),
        )
        votes = [1]  # our own
        if votes[0] >= self.majority():
            self.become_leader()
            return

        for i in range(len(self.peers)):
            if i == self.me:
                continue

            def ask(peer: int) -> None:
                ok, reply = self.send_request_vote(peer, args)
                if not ok:
                    return
                with self.mu:
                    self.handle_vote_reply(term, reply, votes)

            threading.Thread(target=ask, args=(i,), daemon=True).start()

    def handle_vote_reply(
        self, term: int, reply: RequestVoteReply, votes: list[int]
    ) -> None:
        """Count one reply to the election that began in term. mu held."""
        if reply.term > self.current_term:
            self.become_follower(reply.term)
            return
        # A reply can arrive long after the election it belongs to.
        if self.role != CANDIDATE or self.current_term != term or not reply.vote_granted:
            return
        votes[0] += 1
        if votes[0] >= self.majority():
            self.become_leader()

    def become_leader(self) -> None:
        """Take over for the current term and announce it immediately. mu held."""
        self.role = LEADER
        self.leader_id = self.me
        self.reset_leader_progress()
        self.broadcast_append()
