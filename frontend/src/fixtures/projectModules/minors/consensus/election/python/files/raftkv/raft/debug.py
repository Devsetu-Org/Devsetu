"""Hooks for tests and the REPL."""

from __future__ import annotations

from dataclasses import dataclass, field

from .types import LogEntry, Role


@dataclass
class State:
    id: int = 0
    term: int = 0
    role: Role = ""
    voted_for: int = -1
    leader_id: int = -1
    log: list[LogEntry] = field(default_factory=list)
    commit_index: int = 0
    last_applied: int = 0


class DebugMixin:
    def debug_state(self) -> State:
        with self.mu:
            return State(
                id=self.me,
                term=self.current_term,
                role=self.role,
                voted_for=self.voted_for,
                leader_id=self.leader_id,
                log=list(self.log[1:]),
                commit_index=self.commit_index,
                last_applied=self.last_applied,
            )

    def debug_seed(self, term: int, entries: list[LogEntry]) -> None:
        with self.mu:
            self.current_term = term
            self.log = [LogEntry()] + list(entries)
            self.persist()

    def debug_elect(self) -> None:
        with self.mu:
            self.start_election()
