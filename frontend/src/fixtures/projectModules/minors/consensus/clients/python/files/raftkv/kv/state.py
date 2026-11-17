"""Key/value state machine. TODO 5.1."""

from __future__ import annotations

from dataclasses import dataclass, field

from .op import OP_DELETE, OP_GET, OP_PUT, Op


@dataclass
class Result:
    value: bytes = b""
    found: bool = False


class State:
    def __init__(self) -> None:
        self.data: dict[str, bytes] = {}
        self.last_seq: dict[int, int] = {}

    def apply(self, op: Op) -> Result:
        # ── TODO(5.1) — apply once, even if the log says it twice ──────────────
        raise NotImplementedError(
            "TODO(5.1): State.apply — dedupe by (client_id, seq), then Get / Put / Delete"
        )
