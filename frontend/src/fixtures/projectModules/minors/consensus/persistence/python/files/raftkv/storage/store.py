"""Durable storage for one node's persistent state."""

from __future__ import annotations

from typing import Protocol


class Store(Protocol):
    def save(self, state: bytes) -> None:
        """Durably replace the stored state.

        When save returns, the data survives a crash; a crash during save
        leaves the old state or the new state, never a mix.
        """

    def load(self) -> bytes | None:
        """Return the last saved state, or None if none exists."""
