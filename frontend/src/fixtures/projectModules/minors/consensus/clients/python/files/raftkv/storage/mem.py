"""In-memory Store. A harness keeps the Mem across a Crash."""

from __future__ import annotations

import threading


class Mem:
    def __init__(self) -> None:
        self._mu = threading.Lock()
        self._state: bytes | None = None
        self._saves = 0

    def save(self, state: bytes) -> None:
        with self._mu:
            self._state = bytes(state)
            self._saves += 1

    def load(self) -> bytes | None:
        with self._mu:
            if self._state is None:
                return None
            return bytes(self._state)

    def saves(self) -> int:
        with self._mu:
            return self._saves
