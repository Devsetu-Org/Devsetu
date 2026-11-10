"""In-process RPC network that misbehaves on request.

Nodes talk through ClientEnds. Every message is pickled on the way out and
unpickled on the way in, so sender and receiver never share memory, just like
two processes. The Network can cut nodes off, split them into partitions, add
latency, and drop or duplicate messages. A Call that does not get an answer
returns False; the caller cannot tell a lost request from a lost reply.
"""

from __future__ import annotations

import pickle
import random
import threading
import time
from typing import Any, Protocol


class Handler(Protocol):
    def handle(self, method: str, args: bytes) -> bytes:
        """Decode args for method, run it, return the encoded reply.

        Raise ErrDown (or return via exception) when the node cannot answer;
        the caller sees a failed Call.
        """


def encode(v: Any) -> bytes:
    return pickle.dumps(v, protocol=pickle.HIGHEST_PROTOCOL)


def decode(data: bytes) -> Any:
    return pickle.loads(data)


# First id of a client that sits outside the cluster. Partitions split the
# servers only: an external caller can reach every server that is up and not
# disconnected.
ExternalBase = 1000


class ErrDown(Exception):
    """Returned by handlers that are shutting down."""


class Network:
    """Connects numbered nodes."""

    def __init__(self, seed: int = 1) -> None:
        self._mu = threading.Lock()
        self._rng = random.Random(seed)
        self._handlers: dict[int, Handler] = {}
        self._isolated: set[int] = set()
        self._group: dict[int, int] = {}
        self._drop_rate = 0.0
        self._dup_rate = 0.0
        self._min_delay = 0.0
        self._max_delay = 0.0
        self._delivered = 0

    def add(self, id: int, h: Handler) -> None:
        with self._mu:
            self._handlers[id] = h

    def remove(self, id: int) -> None:
        with self._mu:
            self._handlers.pop(id, None)

    def disconnect(self, id: int) -> None:
        with self._mu:
            self._isolated.add(id)

    def connect(self, id: int) -> None:
        with self._mu:
            self._isolated.discard(id)

    def partition(self, *groups: list[int]) -> None:
        with self._mu:
            self._group = {}
            for g, members in enumerate(groups):
                for nid in members:
                    self._group[nid] = g + 1

    def heal(self) -> None:
        with self._mu:
            self._group = {}
            self._isolated.clear()

    def set_unreliable(self, drop: float, dup: float) -> None:
        with self._mu:
            self._drop_rate, self._dup_rate = drop, dup

    def set_delay(self, min_delay: float, max_delay: float) -> None:
        """One-way latency in seconds."""
        with self._mu:
            self._min_delay, self._max_delay = min_delay, max_delay

    def delivered(self) -> int:
        with self._mu:
            return self._delivered

    def _reachable(self, frm: int, to: int) -> bool:
        if frm in self._isolated or to in self._isolated:
            return False
        if frm < ExternalBase and self._group.get(frm, 0) != self._group.get(to, 0):
            return False
        return to in self._handlers

    def _roll(self, p: float) -> bool:
        return p > 0 and self._rng.random() < p

    def _latency(self) -> float:
        if self._max_delay <= 0:
            return 0.0
        span = self._max_delay - self._min_delay
        if span <= 0:
            return self._min_delay
        return self._min_delay + self._rng.random() * span

    def _fail_delay(self) -> float:
        return (5 + self._rng.randint(0, 19)) / 1000.0

    def end(self, frm: int, to: int) -> ClientEnd:
        return ClientEnd(self, frm, to)

    def _bump_delivered(self) -> None:
        with self._mu:
            self._delivered += 1


class ClientEnd:
    """One node's handle for calling another."""

    def __init__(self, net: Network, frm: int, to: int) -> None:
        self._net = net
        self._from = frm
        self._to = to
        self._closed = False
        self._closed_mu = threading.Lock()

    def close(self) -> None:
        with self._closed_mu:
            self._closed = True

    def _is_closed(self) -> bool:
        with self._closed_mu:
            return self._closed

    def call(self, method: str, args: Any) -> tuple[bool, Any]:
        """Send args to method; return (ok, reply). reply is None when ok is False."""
        n = self._net
        payload = encode(args)

        n._mu.acquire()
        if self._is_closed() or not n._reachable(self._from, self._to):
            wait = n._fail_delay()
            n._mu.release()
            time.sleep(wait)
            return False, None
        drop_req = n._roll(n._drop_rate)
        drop_rep = n._roll(n._drop_rate)
        dup = n._roll(n._dup_rate)
        req_delay, rep_delay, dup_delay = n._latency(), n._latency(), n._latency()
        h = n._handlers[self._to]
        fail_wait = n._fail_delay()
        n._mu.release()

        time.sleep(req_delay)
        if drop_req or self._cut():
            time.sleep(fail_wait)
            return False, None

        if dup:
            def _dup_deliver() -> None:
                time.sleep(dup_delay)
                n._bump_delivered()
                try:
                    h.handle(method, payload)
                except Exception:
                    pass

            threading.Thread(target=_dup_deliver, daemon=True).start()

        n._bump_delivered()
        try:
            out = h.handle(method, payload)
        except Exception:
            time.sleep(fail_wait)
            return False, None

        time.sleep(rep_delay)
        if drop_rep or self._cut():
            time.sleep(fail_wait)
            return False, None
        return True, decode(out)

    def _cut(self) -> bool:
        with self._net._mu:
            return self._is_closed() or not self._net._reachable(self._from, self._to)
