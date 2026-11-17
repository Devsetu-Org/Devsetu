"""One node of a Raft cluster.

A Raft value is a state machine driven by RPCs from its peers and a timer.
Everything it knows lives under one mutex, rf.mu. Methods documented "mu held"
must be called with the lock taken.
"""

from __future__ import annotations

import random
import threading
import time
from typing import Protocol

from .commit import CommitMixin
from .debug import DebugMixin
from .election import ElectionMixin
from .persist import PersistMixin
from .replication import ReplicationMixin
from .service import ServiceMixin
from .types import (
    DefaultTiming,
    FOLLOWER,
    LEADER,
    Config,
    LogEntry,
    Timing,
)
from .vote import VoteMixin


class StateMachine(Protocol):
    def apply(self, index: int, command: bytes) -> None:
        """Run the command at log index (1-based). Called once per committed
        entry, in order, from a single thread, without holding any Raft lock.
        """


class Raft(
    ElectionMixin,
    VoteMixin,
    ReplicationMixin,
    CommitMixin,
    PersistMixin,
    ServiceMixin,
    DebugMixin,
):
    def __init__(self, cfg: Config) -> None:
        timing = cfg.timing
        if timing.election_min == 0 and timing.election_max == 0:
            timing = DefaultTiming
        self.mu = threading.RLock()
        self.peers = list(cfg.peers)
        self.me = cfg.me
        self.store = cfg.store
        self.sm = cfg.sm
        self.timing = timing
        self.rng = random.Random(cfg.seed + cfg.me * 7919)
        self._dead = False

        self.current_term = 0
        self.voted_for = -1
        self.log: list[LogEntry] = [LogEntry()]  # sentinel at index 0

        self.role = FOLLOWER
        self.leader_id = -1
        self.commit_index = 0
        self.last_applied = 0
        self.apply_cond = threading.Condition(self.mu)

        n = len(cfg.peers)
        self.next_index = [0] * n
        self.match_index = [0] * n

        self.election_deadline = 0.0
        self.last_broadcast = 0.0

        self.read_persist()
        with self.mu:
            self.reset_election_timer()

        threading.Thread(target=self._ticker, daemon=True).start()
        threading.Thread(target=self.apply_loop, daemon=True).start()

    def kill(self) -> None:
        with self.mu:
            self._dead = True
            self.apply_cond.notify_all()

    def killed(self) -> bool:
        with self.mu:
            return self._dead

    def get_state(self) -> tuple[int, bool]:
        with self.mu:
            return self.current_term, self.role == LEADER

    def leader(self) -> int:
        with self.mu:
            if self.role == LEADER:
                return self.me
            return self.leader_id

    def _ticker(self) -> None:
        while not self.killed():
            time.sleep(self.timing.tick)
            with self.mu:
                if self._dead:
                    return
                now = time.monotonic()
                if self.role == LEADER:
                    if now - self.last_broadcast >= self.timing.heartbeat:
                        self.reset_election_timer()
                        self.broadcast_append()
                elif now > self.election_deadline:
                    self.start_election()

    def reset_election_timer(self) -> None:
        """Push the election deadline a random time into the future. mu held."""
        span = self.timing.election_max - self.timing.election_min
        d = self.timing.election_min
        if span > 0:
            d += self.rng.random() * span
        self.election_deadline = time.monotonic() + d

    def last_log_index(self) -> int:
        return len(self.log) - 1

    def last_log_term(self) -> int:
        return self.log[-1].term

    def majority(self) -> int:
        return len(self.peers) // 2 + 1

    def reset_leader_progress(self) -> None:
        for i in range(len(self.peers)):
            self.next_index[i] = self.last_log_index() + 1
            self.match_index[i] = 0

    def send_request_vote(self, peer: int, args: object) -> tuple[bool, object]:
        from .rpc import METHOD_REQUEST_VOTE

        return self.peers[peer].call(METHOD_REQUEST_VOTE, args)

    def send_append_entries(self, peer: int, args: object) -> tuple[bool, object]:
        from .rpc import METHOD_APPEND_ENTRIES

        return self.peers[peer].call(METHOD_APPEND_ENTRIES, args)


def make(cfg: Config) -> Raft:
    return Raft(cfg)
