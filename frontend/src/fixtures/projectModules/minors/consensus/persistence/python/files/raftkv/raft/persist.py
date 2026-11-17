"""Persistent state. TODO 4.1, 4.2."""

from __future__ import annotations

import pickle
from dataclasses import dataclass

from .types import LogEntry


@dataclass
class PersistentState:
    current_term: int = 0
    voted_for: int = -1
    log: list[LogEntry] | None = None


class PersistMixin:
    def persist(self) -> None:
        """Write current_term, voted_for and the log to the store. mu held."""
        # ── TODO(4.1) — save the three durable fields ──────────────────────────
        pass

    def read_persist(self) -> None:
        """Restore the state saved by persist, if any.

        make calls it once before any thread starts, so no lock is needed.
        """
        # ── TODO(4.2) — come back as the node that crashed ─────────────────────
        pass
