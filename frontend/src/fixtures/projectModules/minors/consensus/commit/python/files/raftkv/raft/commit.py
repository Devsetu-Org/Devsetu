"""Commit and apply. TODO 3.1–3.3."""

from __future__ import annotations

from .types import LEADER, LogEntry


class CommitMixin:
    def advance_commit(self) -> None:
        """Leader's commit rule. mu held."""
        # ── TODO(3.1) — commit by majority, current term only ──────────────────
        raise NotImplementedError(
            "TODO(3.1): advance_commit — majority match_index, current-term entries only"
        )
    def follower_advance_commit(self, leader_commit: int, last_new: int) -> None:
        """Move commit_index toward leader_commit, never past last_new. mu held."""
        # ── TODO(3.2) — a follower trusts only what was verified ───────────────
        raise NotImplementedError(
            "TODO(3.2): follower_advance_commit — min(leader_commit, last verified entry)"
        )
    def apply_loop(self) -> None:
        """Hand committed entries to the state machine until kill."""
        # ── TODO(3.3) — apply, in order, outside the lock ──────────────────────
        raise NotImplementedError(
            "TODO(3.3): apply_loop — apply last_applied+1..commit_index in order, exactly once"
        )
