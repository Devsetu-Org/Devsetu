"""Shared Raft types."""

from __future__ import annotations

from dataclasses import dataclass, field


FOLLOWER = "follower"
CANDIDATE = "candidate"
LEADER = "leader"

Role = str


@dataclass
class LogEntry:
    term: int = 0
    command: bytes = b""


@dataclass
class Timing:
    election_min: float = 0.150  # seconds
    election_max: float = 0.300
    heartbeat: float = 0.030
    tick: float = 0.005


DefaultTiming = Timing()


@dataclass
class Config:
    me: int
    peers: list  # Peer.call(method, args) -> (ok, reply)
    store: object
    sm: object | None = None
    timing: Timing = field(default_factory=Timing)
    seed: int = 1
