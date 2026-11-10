"""Key/value state machine."""

from __future__ import annotations

from dataclasses import dataclass

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
        fresh = op.seq > self.last_seq.get(op.client_id, 0)
        if fresh:
            self.last_seq[op.client_id] = op.seq
        key = op.key.decode()
        if op.kind == OP_GET:
            v = self.data.get(key)
            if v is None:
                return Result(value=b"", found=False)
            return Result(value=bytes(v), found=True)
        if op.kind == OP_PUT:
            if fresh:
                self.data[key] = bytes(op.value)
        elif op.kind == OP_DELETE:
            if fresh:
                self.data.pop(key, None)
        return Result()
