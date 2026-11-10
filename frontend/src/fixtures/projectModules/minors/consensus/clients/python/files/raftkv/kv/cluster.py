"""N KV servers on one in-process network."""

from __future__ import annotations

import threading
from pathlib import Path
from typing import Any, Callable

from raftkv import labrpc, raft, storage

from .client import Clerk
from .server import StartServer


def WithTiming(t: raft.Timing):
    return ("timing", t)


def WithSeed(seed: int):
    return ("seed", seed)


def WithDir(dir: str):
    return ("dir", dir)


class Cluster:
    def __init__(self, n: int, *opts) -> None:
        timing = raft.Timing(
            election_min=0.120,
            election_max=0.240,
            heartbeat=0.025,
            tick=0.004,
        )
        seed = 1
        dir_: str | None = None
        for o in opts:
            if o[0] == "timing":
                timing = o[1]
            elif o[0] == "seed":
                seed = o[1]
            elif o[0] == "dir":
                dir_ = o[1]
        self.n = n
        self.net = labrpc.Network(seed)
        self.opts_timing = timing
        self.opts_seed = seed
        self._mu = threading.Lock()
        self.srv: list[Any] = [None] * n
        self.ends: list[list] = [[] for _ in range(n)]
        self.durable: list[Any] = [None] * n
        self.fences: list[Any] = [None] * n
        self.gen = [0] * n
        self.clerks = 0
        for i in range(n):
            if dir_:
                self.durable[i] = storage.File(str(Path(dir_) / f"server-{i}"))
            else:
                self.durable[i] = storage.Mem()
        for i in range(n):
            self._boot(i)

    def _boot(self, i: int) -> None:
        with self._mu:
            self.gen[i] += 1
            gen = self.gen[i]
            self.fences[i] = storage.Fenced(self.durable[i])
            ends = [self.net.end(i, j) for j in range(self.n)]
            self.ends[i] = ends
            fence = self.fences[i]
        s = StartServer(
            i, ends, fence, self.opts_timing, self.opts_seed + gen * 104729
        )
        with self._mu:
            self.srv[i] = s
        self.net.add(i, s)

    def N(self) -> int:
        return self.n

    def Net(self) -> labrpc.Network:
        return self.net

    def Server(self, i: int):
        with self._mu:
            return self.srv[i]

    def NewClerk(self) -> Clerk:
        with self._mu:
            self.clerks += 1
            frm = labrpc.ExternalBase + self.clerks
        ends = [self.net.end(frm, i) for i in range(self.n)]
        return Clerk(ends)

    def Partition(self, *groups: list[int]) -> None:
        self.net.partition(*groups)

    def Heal(self) -> None:
        self.net.heal()

    def Disconnect(self, i: int) -> None:
        self.net.disconnect(i)

    def Connect(self, i: int) -> None:
        self.net.connect(i)

    def Crash(self, i: int) -> None:
        with self._mu:
            s, ends, fence = self.srv[i], self.ends[i], self.fences[i]
            self.srv[i] = None
        if s is None:
            return
        self.net.remove(i)
        for e in ends:
            e.close()
        fence.fence()
        s.kill()

    def Restart(self, i: int) -> None:
        self._boot(i)

    def Leader(self) -> tuple[int, bool]:
        best, best_term = -1, -1
        for i in range(self.n):
            s = self.Server(i)
            if s is None:
                continue
            term, ok = s.raft().get_state()
            if ok and term > best_term:
                best, best_term = i, term
        return best, best >= 0

    def Shutdown(self) -> None:
        for i in range(self.n):
            self.Crash(i)


def StartCluster(n: int, *opts) -> Cluster:
    return Cluster(n, *opts)
