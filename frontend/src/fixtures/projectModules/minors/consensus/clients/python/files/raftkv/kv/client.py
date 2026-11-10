"""KV client. TODO 5.4."""

from __future__ import annotations

import itertools
import threading
import time

from .op import ERR_NOT_LEADER, ExecuteArgs, ExecuteReply, Op, OP_DELETE, OP_GET, OP_PUT
from .state import Result

ErrUnavailable = RuntimeError("kv: no leader committed the request in time")

_next_client_id = itertools.count(1)
_id_lock = threading.Lock()


class Clerk:
    def __init__(self, ends: list) -> None:
        self.timeout = 10.0
        self.ends = ends
        with _id_lock:
            self.id = next(_next_client_id)
        self.seq = 0
        self.leader = 0

    def put(self, key: bytes, value: bytes) -> None:
        self.do(Op(kind=OP_PUT, key=key, value=value))

    def delete(self, key: bytes) -> None:
        self.do(Op(kind=OP_DELETE, key=key))

    def get(self, key: bytes) -> tuple[bytes, bool]:
        res = self.do(Op(kind=OP_GET, key=key))
        return res.value, res.found

    def do(self, op: Op) -> Result:
        # ── TODO(5.4) — find the leader and keep asking ────────────────────────
        #
        # Stamp the op once: self.seq += 1; op.client_id = self.id; op.seq = self.seq.
        # Every retry sends THIS op unchanged.
        #
        # Until timeout: call self.ends[self.leader].call("KV.Execute",
        # ExecuteArgs(op=op)) with a fresh reply.
        #
        #  - Call returned True and reply.err == "": done.
        #  - Anything else: pick the next server. Follow reply.leader when the
        #    server gave a valid hint, unless that server just failed. Otherwise
        #    move round-robin.
        #  - After a full lap of failures, sleep ~0.025s.
        #
        # When the deadline passes, raise ErrUnavailable.
        raise NotImplementedError(
            "TODO(5.4): Clerk.do — retry the same (client_id, seq) across servers"
        )
