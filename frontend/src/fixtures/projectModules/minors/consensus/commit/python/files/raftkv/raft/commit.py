"""Commit and apply. TODO 3.1–3.3."""

from __future__ import annotations

from .types import LEADER, LogEntry


class CommitMixin:
    def advance_commit(self) -> None:
        """Leader's commit rule. mu held."""
        # ── TODO(3.1) — commit by majority, current term only ──────────────────
        #
        # Do nothing unless we are the leader. Then try N from self.last_log_index()
        # down to self.commit_index+1:
        #
        #  - If self.log[N].term != self.current_term, stop. Terms never decrease
        #    along a log, so every lower index is older too.
        #  - Count replicas: the leader itself (1) plus every peer i != self.me
        #    with self.match_index[i] >= N.
        #  - At self.majority() replicas, set self.commit_index = N, wake the
        #    apply loop with self.apply_cond.notify_all(), and return.
        raise NotImplementedError(
            "TODO(3.1): advance_commit — majority match_index, current-term entries only"
        )

    def follower_advance_commit(self, leader_commit: int, last_new: int) -> None:
        """Move commit_index toward leader_commit, never past last_new. mu held."""
        # ── TODO(3.2) — a follower trusts only what was verified ───────────────
        #
        # Compute min(leader_commit, last_new); if that is above self.commit_index,
        # move commit_index up to it and self.apply_cond.notify_all().
        raise NotImplementedError(
            "TODO(3.2): follower_advance_commit — min(leader_commit, last verified entry)"
        )

    def apply_loop(self) -> None:
        """Hand committed entries to the state machine until kill."""
        # ── TODO(3.3) — apply, in order, outside the lock ──────────────────────
        #
        # with self.mu for the whole loop and loop while not self._dead:
        #
        #  - If self.last_applied >= self.commit_index, self.apply_cond.wait()
        #    and go round again.
        #  - Otherwise copy the entries last_applied+1 .. commit_index out of the
        #    log, set self.last_applied = self.commit_index, unlock, call
        #    self.sm.apply(index, command) for each in order (skip if self.sm is
        #    None, stop early if killed), then lock again.
        #
        # Never call apply with self.mu held.
        raise NotImplementedError(
            "TODO(3.3): apply_loop — apply last_applied+1..commit_index in order, exactly once"
        )
