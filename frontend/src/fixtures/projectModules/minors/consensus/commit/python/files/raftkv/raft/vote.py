"""RequestVote handler."""

from __future__ import annotations

from .rpc import RequestVoteArgs, RequestVoteReply


class VoteMixin:
    def request_vote(self, args: RequestVoteArgs) -> RequestVoteReply:
        """RPC handler a candidate calls to ask for our vote."""
        with self.mu:
            # A newer term means whatever we were doing is stale: step down first.
            if args.term > self.current_term:
                self.become_follower(args.term)

            reply = RequestVoteReply(term=self.current_term, vote_granted=False)

            if args.term < self.current_term:
                return reply
            # One vote per term. Granting the same candidate twice is fine.
            can_vote = self.voted_for == -1 or self.voted_for == args.candidate_id
            if can_vote and self.log_up_to_date(args.last_log_term, args.last_log_index):
                self.voted_for = args.candidate_id
                self.persist()
                self.reset_election_timer()
                reply.vote_granted = True
            return reply

    def log_up_to_date(self, last_term: int, last_index: int) -> bool:
        """Whether a candidate's last entry is at least as up to date as ours.

        A later last term wins; with equal last terms, the longer log wins.
        mu held.
        """
        if last_term != self.last_log_term():
            return last_term > self.last_log_term()
        return last_index >= self.last_log_index()
