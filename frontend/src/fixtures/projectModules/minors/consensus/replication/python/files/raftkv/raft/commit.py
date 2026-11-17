"""Chapter 3 replaces this file. Until then nothing commits."""


class CommitMixin:
    def advance_commit(self) -> None:
        """Leader's commit rule. mu held."""

    def follower_advance_commit(self, leader_commit: int, last_new: int) -> None:
        """Move a follower's commit_index toward leader_commit. mu held."""

    def apply_loop(self) -> None:
        """Hand committed entries to the state machine until kill."""
