"""KV client."""

from __future__ import annotations

import itertools
import threading
import time

from .op import ERR_NOT_LEADER, ExecuteArgs, Op, OP_DELETE, OP_GET, OP_PUT
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
        self.seq += 1
        op.client_id, op.seq = self.id, self.seq
        deadline = time.monotonic() + self.timeout
        failed_at: dict[int, int] = {}
        attempt = 0
        while time.monotonic() < deadline:
            attempt += 1
            server = self.leader
            ok, reply = self.ends[server].call("KV.Execute", ExecuteArgs(op=op))
            if ok and reply is not None and reply.err == "":
                return Result(value=reply.value, found=reply.found)
            failed_at[server] = attempt
            nxt = (server + 1) % len(self.ends)
            if (
                ok
                and reply is not None
                and reply.err == ERR_NOT_LEADER
                and 0 <= reply.leader < len(self.ends)
            ):
                last = failed_at.get(reply.leader)
                if last is None or attempt - last >= len(self.ends):
                    nxt = reply.leader
            self.leader = nxt
            if attempt % len(self.ends) == 0:
                time.sleep(0.025)
        raise ErrUnavailable
