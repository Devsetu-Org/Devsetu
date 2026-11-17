"""Run a Raft cluster inside one process and watch it."""

from __future__ import annotations

import threading
import time
import unittest
from typing import Any, Callable

from raftkv import labrpc
from raftkv import raft
from raftkv import storage

from .monitor import MonitorMixin


class FastTiming:
    election_min = 0.120
    election_max = 0.240
    heartbeat = 0.025
    tick = 0.004


def WithTiming(t: raft.Timing):
    return ("timing", t)


def WithSeed(seed: int):
    return ("seed", seed)


def WithStores(stores: Callable[[int], Any]):
    return ("stores", stores)


def Manual():
    return ("manual", True)


class Cluster(MonitorMixin):
    def __init__(self, test: unittest.TestCase, n: int, *opts) -> None:
        timing = raft.Timing(
            election_min=FastTiming.election_min,
            election_max=FastTiming.election_max,
            heartbeat=FastTiming.heartbeat,
            tick=FastTiming.tick,
        )
        seed = 1
        stores_fn = None
        manual = False
        for o in opts:
            if o[0] == "timing":
                timing = o[1]
            elif o[0] == "seed":
                seed = o[1]
            elif o[0] == "stores":
                stores_fn = o[1]
            elif o[0] == "manual":
                manual = True
        if manual:
            timing = raft.Timing(
                election_min=3600.0,
                election_max=7200.0,
                heartbeat=timing.heartbeat,
                tick=timing.tick,
            )

        self.t = test
        self.n = n
        self.net = labrpc.Network(seed)
        self.timing = timing
        self.seed = seed

        self._mu = threading.Lock()
        self.rafts: list[raft.Raft | None] = [None] * n
        self.ends: list[list[labrpc.ClientEnd]] = [[] for _ in range(n)]
        self.durable: list[Any] = [None] * n
        self.fences: list[storage.Fenced | None] = [None] * n
        self.up = [False] * n
        self.cut = [False] * n
        self.gen = [0] * n
        self.last_apply = [0] * n
        self.applied: list[dict[int, bytes]] = [{} for _ in range(n)]
        self.committed: dict[int, bytes] = {}
        self.leaders: dict[int, int] = {}

        self._stop = threading.Event()
        self._done = threading.Event()
        self._once = threading.Lock()
        self._shut = False
        self._fatal: str | None = None

        for i in range(n):
            self.durable[i] = stores_fn(i) if stores_fn else storage.Mem()
        for i in range(n):
            self._start(i)
        threading.Thread(target=self._monitor, daemon=True).start()
        test.addCleanup(self.shutdown)

    def _start(self, i: int) -> None:
        with self._mu:
            self.gen[i] += 1
            gen = self.gen[i]
            self.last_apply[i] = 0
            self.applied[i] = {}
            self.fences[i] = storage.Fenced(self.durable[i])
            fence = self.fences[i]
            ends = [self.net.end(i, j) for j in range(self.n)]
            self.ends[i] = ends

        peers = list(ends)
        rf = raft.make(
            raft.Config(
                me=i,
                peers=peers,
                store=fence,
                sm=_Recorder(self, i, gen),
                timing=self.timing,
                seed=self.seed + gen * 104729,
            )
        )
        with self._mu:
            self.rafts[i] = rf
            self.up[i] = True
        self.net.add(i, rf)

    def shutdown(self) -> None:
        with self._once:
            if self._shut:
                return
            self._shut = True
        self._stop.set()
        self._done.wait(timeout=5)
        with self._mu:
            for i in range(self.n):
                if self.rafts[i] is not None:
                    self.rafts[i].kill()
                    for e in self.ends[i]:
                        e.close()
                    if self.fences[i] is not None:
                        self.fences[i].fence()

    def _report(self, msg: str) -> None:
        """Record a safety violation; the next Check* call fails the test."""
        with self._mu:
            if self._fatal is None:
                self._fatal = msg

    def _check_fatal(self) -> None:
        with self._mu:
            msg = self._fatal
        if msg is not None:
            self.t.fail(msg)

    def N(self) -> int:
        return self.n

    def Net(self) -> labrpc.Network:
        return self.net

    def Raft(self, i: int) -> raft.Raft:
        with self._mu:
            return self.rafts[i]  # type: ignore[return-value]

    def State(self, i: int) -> raft.State:
        return self.Raft(i).debug_state()

    def Disconnect(self, i: int) -> None:
        with self._mu:
            self.cut[i] = True
        self.net.disconnect(i)

    def Connect(self, i: int) -> None:
        with self._mu:
            self.cut[i] = False
        self.net.connect(i)

    def Partition(self, *groups: list[int]) -> None:
        self.net.partition(*groups)

    def Heal(self) -> None:
        with self._mu:
            for i in range(self.n):
                self.cut[i] = False
        self.net.heal()

    def Crash(self, i: int) -> None:
        with self._mu:
            if not self.up[i]:
                return
            self.up[i] = False
            rf = self.rafts[i]
            ends = self.ends[i]
            fence = self.fences[i]
        self.net.remove(i)
        for e in ends:
            e.close()
        if fence is not None:
            fence.fence()
        if rf is not None:
            rf.kill()

    def Restart(self, i: int) -> None:
        with self._mu:
            up = self.up[i]
        if up:
            self.t.fail(f"labharness: Restart({i}) but the node is up")
        self._start(i)

    def Up(self, i: int) -> bool:
        with self._mu:
            return self.up[i]

    def Campaign(self, i: int) -> None:
        self.Raft(i).debug_elect()

    def _live(self, nodes: list[int] | None) -> list[int]:
        if nodes:
            return list(nodes)
        with self._mu:
            return [i for i in range(self.n) if self.up[i] and not self.cut[i]]

    def _leaders_among(self, s: list[int]) -> tuple[list[int], list[int]]:
        ids: list[int] = []
        terms: list[int] = []
        for i in s:
            if not self.Up(i):
                continue
            term, is_leader = self.Raft(i).get_state()
            if is_leader:
                ids.append(i)
                terms.append(term)
        return ids, terms

    def CheckOneLeader(self, *nodes: int) -> int:
        s = self._live(list(nodes) if nodes else None)
        deadline = time.monotonic() + 5.0
        while True:
            self._check_fatal()
            ids, terms = self._leaders_among(s)
            if len(ids) == 1:
                return ids[0]
            for a in range(len(ids)):
                for b in range(a + 1, len(ids)):
                    if terms[a] == terms[b]:
                        self.t.fail(
                            f"nodes {ids[a]} and {ids[b]} both lead term {terms[a]}"
                        )
            if time.monotonic() > deadline:
                if not ids:
                    self.t.fail(f"no leader among {s} after 5s")
                self.t.fail(
                    f"leaders {ids} among {s} (terms {terms}) did not settle on one in 5s"
                )
            time.sleep(0.020)

    def CheckNoLeader(self, window: float, *nodes: int) -> None:
        s = self._live(list(nodes) if nodes else None)
        end = time.monotonic() + window
        while time.monotonic() < end:
            ids, terms = self._leaders_among(s)
            if ids:
                self.t.fail(
                    f"node {ids[0]} leads term {terms[0]}, but {s} should not be able to elect a leader"
                )
            time.sleep(0.010)

    def Eventually(self, d: float, msg: str, cond: Callable[[], bool]) -> None:
        deadline = time.monotonic() + d
        while not cond():
            if time.monotonic() > deadline:
                self.t.fail(f"timed out after {d}s waiting for {msg}")
            time.sleep(0.005)

    def Submit(self, cmd: str, want: int) -> int:
        deadline = time.monotonic() + 10.0
        attempt = 0
        while time.monotonic() < deadline:
            index = -1
            for k in range(self.n):
                i = (attempt + k) % self.n
                if not self.Up(i) or self._is_cut(i):
                    continue
                idx, _, ok = self.Raft(i).start(cmd.encode())
                if ok:
                    index = idx
                    break
            attempt += 1
            if index < 0:
                time.sleep(0.020)
                continue
            until = time.monotonic() + 1.5
            while time.monotonic() < until:
                if self.CountApplied(index, cmd) >= want:
                    return index
                time.sleep(0.010)
        self.t.fail(f"command {cmd!r} was not committed on {want} servers in 10s")
        return -1

    def _is_cut(self, i: int) -> bool:
        with self._mu:
            return self.cut[i]

    def CountApplied(self, index: int, cmd: str) -> int:
        with self._mu:
            n = 0
            for i in range(self.n):
                got = self.applied[i].get(index)
                if got is not None:
                    if got.decode() != cmd:
                        return 0
                    n += 1
            return n

    def Applied(self, i: int) -> int:
        with self._mu:
            return self.last_apply[i]

    def AppliedCommand(self, i: int, index: int) -> tuple[str, bool]:
        with self._mu:
            cmd = self.applied[i].get(index)
            if cmd is None:
                return "", False
            return cmd.decode(), True

    def Committed(self, index: int) -> tuple[str, bool]:
        with self._mu:
            cmd = self.committed.get(index)
            if cmd is None:
                return "", False
            return cmd.decode(), True

    def CommittedCount(self) -> int:
        with self._mu:
            return max(self.committed.keys(), default=0)

    def LogCommands(self, i: int) -> list[str]:
        st = self.State(i)
        return [e.command.decode() for e in st.log]

    def Start(self, cmd: str) -> tuple[int, int]:
        deadline = time.monotonic() + 5.0
        while time.monotonic() < deadline:
            for i in range(self.n):
                if not self.Up(i):
                    continue
                idx, _, ok = self.Raft(i).start(cmd.encode())
                if ok:
                    return idx, i
            time.sleep(0.020)
        self.t.fail(f"no node accepted {cmd!r} as leader in 5s")
        return -1, -1

    def WaitLogs(self, want: int, *nodes: int) -> list[str]:
        if not nodes:
            nodes = tuple(i for i in range(self.n) if self.Up(i))
        last: list[str] = []

        def cond() -> bool:
            nonlocal last
            last = self.LogCommands(nodes[0])
            if len(last) != want:
                return False
            for i in nodes[1:]:
                got = self.LogCommands(i)
                if got != last:
                    return False
            return True

        self.Eventually(8.0, f"nodes {nodes} to hold the same {want}-entry log", cond)
        return last

    def Leader(self) -> tuple[int, bool]:
        best, best_term = -1, -1
        for i in range(self.n):
            if not self.Up(i):
                continue
            term, ok = self.Raft(i).get_state()
            if ok and term > best_term:
                best, best_term = i, term
        return best, best >= 0


class _Recorder:
    def __init__(self, c: Cluster, server: int, gen: int) -> None:
        self.c = c
        self.server = server
        self.gen = gen

    def apply(self, index: int, command: bytes) -> None:
        c = self.c
        with c._mu:
            if c.gen[self.server] != self.gen:
                return
            if index != c.last_apply[self.server] + 1:
                c.t.fail(
                    f"server {self.server} applied index {index} right after "
                    f"{c.last_apply[self.server]}: apply must be in order, each index once"
                )
            prev = c.committed.get(index)
            if prev is not None and prev != command:
                c.t.fail(
                    f"SAFETY: server {self.server} applied {command!r} at index {index}, "
                    f"but {prev!r} was already committed there"
                )
            elif prev is None:
                c.committed[index] = bytes(command)
            c.applied[self.server][index] = bytes(command)
            c.last_apply[self.server] = index
