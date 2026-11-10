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
        #
        #  - fresh := op.seq > self.last_seq.get(op.client_id, 0); if fresh, record it.
        #  - OP_GET: read self.data[op.key.decode()] and return a COPY of the
        #    value and whether the key exists. A Get runs every time.
        #  - OP_PUT: if fresh, store a COPY of op.value.
        #  - OP_DELETE: if fresh, delete the key.
        #
        # Return Result() for Put and Delete.
        raise NotImplementedError(
            "TODO(5.1): State.apply — dedupe by (client_id, seq), then Get / Put / Delete"
        )
