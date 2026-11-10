"""Fence a Store so a crashed node's leftover threads cannot write."""

from __future__ import annotations

import threading
from typing import Any


class Fenced:
    def __init__(self, inner: Any) -> None:
        self._mu = threading.Lock()
        self._inner = inner
        self._fenced = False

    def fence(self) -> None:
        with self._mu:
            self._fenced = True

    def save(self, state: bytes) -> None:
        with self._mu:
            if self._fenced:
                return
            self._inner.save(state)

    def load(self) -> bytes | None:
        return self._inner.load()
