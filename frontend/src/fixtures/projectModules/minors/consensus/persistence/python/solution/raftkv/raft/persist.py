"""Persistent state."""

from __future__ import annotations

import pickle
from dataclasses import dataclass, field

from .types import LogEntry


@dataclass
class PersistentState:
    current_term: int = 0
    voted_for: int = -1
    log: list[LogEntry] = field(default_factory=list)


class PersistMixin:
    def persist(self) -> None:
        state = PersistentState(
            current_term=self.current_term,
            voted_for=self.voted_for,
            log=list(self.log),
        )
        data = pickle.dumps(state, protocol=pickle.HIGHEST_PROTOCOL)
        self.store.save(data)

    def read_persist(self) -> None:
        data = self.store.load()
        if not data:
            return
        state = pickle.loads(data)
        self.current_term = state.current_term
        self.voted_for = state.voted_for
        self.log = list(state.log) if state.log else [LogEntry()]
        if not self.log:
            self.log = [LogEntry()]
