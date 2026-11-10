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
            #
            # The leader says "the entry before these is (prev_log_index,
            # prev_log_term)". Appending after anything else would leave a hole
            # or splice onto a different history.
            #
            #  - If prev_log_index is past our last entry, set
            #    reply.conflict_index to self.last_log_index()+1 and return
            #    (success stays False).
            #  - If we have that index but with a different term t, set
            #    reply.conflict_index to the FIRST index of our run of term-t
            #    entries (walk back while the previous entry also has term t,
            #    never below 1), and return.
            #
            # When the check passes, call self.append_to_log(args.prev_log_index,
            # args.entries), then self.follower_advance_commit(args.leader_commit,
            # args.prev_log_index+len(args.entries)) (a no-op until chapter 3),
            # and set reply.success = True.
            raise NotImplementedError(
                "TODO(2.1): append_entries — check prev_log_index/term, report conflict_index"
            )

    def append_to_log(self, prev_index: int, entries: list[LogEntry]) -> None:
        """Place entries after prev_index. mu held."""
        # ── TODO(2.2) — truncate only on a real conflict ───────────────────────
        #
        # Walk entries; entry k belongs at index prev_index+1+k.
        #
        #  - If that index is inside our log and the terms match, skip it. Do
        #    NOT truncate. A delayed or duplicated RPC can carry a shorter
        #    prefix of what we have.
        #  - If the index is inside our log and the terms differ, cut the log
        #    at that index (self.log = self.log[:idx]) and fall through to append.
        #  - Past the end of the log, append the entry.
        #
        # If anything changed, call self.persist() once at the end.
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
        #
        # Under the lock: return if killed or not the leader. Build the args from
        # self.next_index[peer]: prev_log_index = next-1, prev_log_term = that
        # entry's term, entries = a COPY of self.log[next:], leader_commit =
        # self.commit_index. Unlock, then send.
        #
        # After a reply, lock again and:
        #  - reply.term > self.current_term: become_follower(reply.term), return.
        #  - Ignore the reply unless we are still the leader of args.term.
        #  - Success: match_index[peer] = prev_log_index+len(entries), but only
        #    ever upward; then next_index[peer] = match_index[peer]+1 (never
        #    lower than it was), and call self.advance_commit().
        #  - Failure: back next_index[peer] up to reply.conflict_index (at least
        #    1, never at or below match_index[peer]), but only if that moves it
        #    down, and retry at once with a new thread calling replicate_to.
        raise NotImplementedError(
            "TODO(2.3): replicate_to — send from next_index, track match_index, back up on refusal"
        )

    def start(self, command: bytes) -> tuple[int, int, bool]:
        """Ask the cluster to replicate command. Only a leader accepts it."""
        # ── TODO(2.4) — accept a command ───────────────────────────────────────
        #
        # Under the lock: if killed or not the leader, return -1, self.current_term,
        # False. Otherwise append LogEntry(term=self.current_term, command=bytes(command)),
        # self.persist(), self.broadcast_append(), and return the new entry's
        # index, the current term, and True.
        raise NotImplementedError(
            "TODO(2.4): start — append to the leader's log and replicate"
        )
