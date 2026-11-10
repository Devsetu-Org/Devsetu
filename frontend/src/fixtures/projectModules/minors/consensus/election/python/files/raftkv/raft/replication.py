"""Chapter 1 only needs heartbeats. Chapter 2 replaces this whole file."""

from __future__ import annotations

import threading
import time

from .rpc import AppendEntriesArgs, AppendEntriesReply
from .types import LEADER


class ReplicationMixin:
    def append_entries(self, args: AppendEntriesArgs) -> AppendEntriesReply:
        """RPC handler a leader calls to say "I am still here"."""
        with self.mu:
            reply = AppendEntriesReply(term=self.current_term, success=False)
            if args.term < self.current_term:
                return reply
            self.become_follower(args.term)
            self.leader_id = args.leader_id
            self.reset_election_timer()
            reply.term = self.current_term
            reply.success = True
            return reply

    def broadcast_append(self) -> None:
        """Send every follower a heartbeat. Returns at once. mu held."""
        self.last_broadcast = time.monotonic()
        for i in range(len(self.peers)):
            if i != self.me:
                threading.Thread(target=self.send_heartbeat, args=(i,), daemon=True).start()

    def send_heartbeat(self, peer: int) -> None:
        with self.mu:
            if self._dead or self.role != LEADER:
                return
            args = AppendEntriesArgs(term=self.current_term, leader_id=self.me)
        ok, reply = self.send_append_entries(peer, args)
        if not ok:
            return
        with self.mu:
            if reply.term > self.current_term:
                self.become_follower(reply.term)

    def start(self, command: bytes) -> tuple[int, int, bool]:
        """Ask the cluster to replicate command. Not yet in chapter 1."""
        with self.mu:
            return -1, self.current_term, False
