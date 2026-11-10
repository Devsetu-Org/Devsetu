"""KV server."""

from __future__ import annotations

import queue
import threading
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
        self.waiters: dict[int, queue.Queue] = {}

    def apply(self, index: int, command: bytes) -> None:
        try:
            op = decode_op(command)
        except Exception:
            return
        with self.mu:
            result = self.state.apply(op)
            ch = self.waiters.pop(index, None)
            if ch is not None:
                ch.put(_Applied(client_id=op.client_id, seq=op.seq, result=result))

    def execute(self, args: ExecuteArgs) -> ExecuteReply:
        op = args.op
        reply = ExecuteReply(leader=-1)
        ch: queue.Queue = queue.Queue(maxsize=1)
        with self.mu:
            assert self.rf is not None
            index, _, is_leader = self.rf.start(encode_op(op))
            if not is_leader:
                reply.err = ERR_NOT_LEADER
                reply.leader = self.rf.leader()
                return reply
            old = self.waiters.get(index)
            if old is not None:
                # Previous waiter lost the slot.
                try:
                    old.put_nowait(None)
                except queue.Full:
                    pass
            self.waiters[index] = ch

        try:
            got = ch.get(timeout=self.timeout)
        except queue.Empty:
            with self.mu:
                if self.waiters.get(index) is ch:
                    del self.waiters[index]
            reply.err = ERR_TIMEOUT
            return reply

        if got is None or got.client_id != op.client_id or got.seq != op.seq:
            assert self.rf is not None
            reply.err = ERR_NOT_LEADER
            reply.leader = self.rf.leader()
            return reply
        reply.value, reply.found = got.result.value, got.result.found
        return reply

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
