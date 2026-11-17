"""AppendEntries and log replication. TODO 2.1–2.4."""

from __future__ import annotations

import threading
import time

from .rpc import AppendEntriesArgs, AppendEntriesReply
from .types import LEADER, LogEntry


class ReplicationMixin:
    def append_entries(self, args: AppendEntriesArgs) -> AppendEntriesReply:
        """RPC handler a leader calls to replicate entries (or heartbeat)."""
        with self.mu:
            reply = AppendEntriesReply(term=self.current_term, success=False)
            if args.term < self.current_term:
                return reply

            self.become_follower(args.term)
            self.leader_id = args.leader_id
            self.reset_election_timer()
            reply.term = self.current_term

            # ── TODO(2.1) — refuse a log that does not line up ─────────────────
            raise NotImplementedError(
                "TODO(2.1): append_entries — check prev_log_index/term, report conflict_index"
            )
    def append_to_log(self, prev_index: int, entries: list[LogEntry]) -> None:
        """Place entries after prev_index. mu held."""
        # ── TODO(2.2) — truncate only on a real conflict ───────────────────────
        raise NotImplementedError(
            "TODO(2.2): append_to_log — skip matching entries, cut at the first conflict"
        )
    def broadcast_append(self) -> None:
        """Send every follower whatever it is missing. Returns at once. mu held."""
        self.last_broadcast = time.monotonic()
        for i in range(len(self.peers)):
            if i != self.me:
                threading.Thread(target=self.replicate_to, args=(i,), daemon=True).start()

    def replicate_to(self, peer: int) -> None:
        """Send one AppendEntries to peer and act on the answer."""
        # ── TODO(2.3) — catch one follower up ──────────────────────────────────
        raise NotImplementedError(
            "TODO(2.3): replicate_to — send from next_index, track match_index, back up on refusal"
        )
    def start(self, command: bytes) -> tuple[int, int, bool]:
        """Ask the cluster to replicate command. Only a leader accepts it."""
        # ── TODO(2.4) — accept a command ───────────────────────────────────────
        raise NotImplementedError(
            "TODO(2.4): start — append to the leader's log and replicate"
        )
