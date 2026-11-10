"""KV server. TODO 5.2, 5.3."""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass

from raftkv import raft
from raftkv.labrpc import decode, encode

from .op import (
    ERR_NOT_LEADER,
    ERR_TIMEOUT,
    ExecuteArgs,
    ExecuteReply,
    decode_op,
    encode_op,
)
from .state import Result, State


@dataclass
class _Applied:
    client_id: int
    seq: int
    result: Result


class Server:
    def __init__(self) -> None:
        self.me = 0
        self.rf: raft.Raft | None = None
        self.timeout = 0.600
        self.mu = threading.Lock()
        self.state = State()
        self.waiters: dict[int, list] = {}  # index -> [queue.Queue]

    def apply(self, index: int, command: bytes) -> None:
        # ── TODO(5.2) — apply, then tell whoever is waiting ────────────────────
        #
        # Decode the op with decode_op (skip the entry if it does not decode).
        # Under self.mu, run self.state.apply(op). If an Execute call registered
        # a queue for this index in self.waiters, delete it and put
        # _Applied(client_id, seq, result). The queue has room for one value.
        raise NotImplementedError(
            "TODO(5.2): Server.apply — run the op, answer the waiter at this index"
        )

    def execute(self, args: ExecuteArgs) -> ExecuteReply:
        # ── TODO(5.3) — submit and wait ────────────────────────────────────────
        #
        #  1. Make a queue.Queue(maxsize=1). Under self.mu, call
        #     self.rf.start(encode_op(args.op)) and, if it accepted, register
        #     the queue in self.waiters[index]. Both under ONE lock hold.
        #  2. Not the leader: reply.err = ERR_NOT_LEADER and reply.leader =
        #     self.rf.leader(). Always set reply.leader = -1 first.
        #  3. Wait on the queue with timeout self.timeout.
        #       - A mismatched (client_id, seq): reply ERR_NOT_LEADER.
        #       - A match: copy value and found.
        #       - Timeout: remove our waiter and reply ERR_TIMEOUT.
        raise NotImplementedError(
            "TODO(5.3): Server.execute — Start, wait for the apply, detect lost leadership"
        )

    def raft(self) -> raft.Raft:
        assert self.rf is not None
        return self.rf

    def kill(self) -> None:
        if self.rf is not None:
            self.rf.kill()

    def handle(self, method: str, data: bytes) -> bytes:
        if method == "KV.Execute":
            args = decode(data)
            reply = self.execute(args)
            return encode(reply)
        if method.startswith("Raft."):
            assert self.rf is not None
            return self.rf.handle(method, data)
        raise ValueError(f"kv: unknown method {method!r}")


def StartServer(
    me: int, peers: list, store, timing: raft.Timing, seed: int
) -> Server:
    s = Server()
    s.me = me
    s.state = State()
    s.waiters = {}
    s.rf = raft.make(
        raft.Config(me=me, peers=peers, store=store, sm=s, timing=timing, seed=seed)
    )
    return s
