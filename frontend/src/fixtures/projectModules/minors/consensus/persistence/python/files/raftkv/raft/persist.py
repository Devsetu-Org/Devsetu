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
        #
        # Pickle-encode a PersistentState(self.current_term, self.voted_for,
        # self.log) and hand the bytes to self.store.save. If save raises, let
        # it propagate: a node that cannot write must not keep answering as if
        # it had, because the reply it is about to send is a promise.
        #
        # persist is called with the lock held and BEFORE the RPC reply goes out.
        pass  # no-op until implemented; earlier chapters keep running

    def read_persist(self) -> None:
        """Restore the state saved by persist, if any.

        make calls it once before any thread starts, so no lock is needed.
        """
        # ── TODO(4.2) — come back as the node that crashed ─────────────────────
        #
        # self.store.load returns None on first boot: then leave the fresh state
        # alone. Otherwise pickle-decode a PersistentState and copy current_term,
        # voted_for and log back. Keep the sentinel: if the decoded log is empty
        # or None, use [LogEntry()].
        #
        # Do not restore commit_index or last_applied. They are rebuilt.
        pass
