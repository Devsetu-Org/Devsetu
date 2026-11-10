"""AppendEntries and log replication."""

from __future__ import annotations

import threading
import time

from .rpc import AppendEntriesArgs, AppendEntriesReply
from .types import LEADER, LogEntry


class ReplicationMixin:
    def append_entries(self, args: AppendEntriesArgs) -> AppendEntriesReply:
        with self.mu:
            reply = AppendEntriesReply(term=self.current_term, success=False)
            if args.term < self.current_term:
                return reply

            self.become_follower(args.term)
            self.leader_id = args.leader_id
            self.reset_election_timer()
            reply.term = self.current_term

            if args.prev_log_index > self.last_log_index():
                reply.conflict_index = self.last_log_index() + 1
                return reply
            t = self.log[args.prev_log_index].term
            if t != args.prev_log_term:
                i = args.prev_log_index
                while i > 1 and self.log[i - 1].term == t:
                    i -= 1
                reply.conflict_index = i
                return reply

            self.append_to_log(args.prev_log_index, args.entries)
            self.follower_advance_commit(
                args.leader_commit, args.prev_log_index + len(args.entries)
            )
            reply.success = True
            return reply

    def append_to_log(self, prev_index: int, entries: list[LogEntry]) -> None:
        changed = False
        for k, e in enumerate(entries):
            idx = prev_index + 1 + k
            if idx <= self.last_log_index():
                if self.log[idx].term == e.term:
                    continue
                self.log = self.log[:idx]
            self.log.append(LogEntry(term=e.term, command=bytes(e.command)))
            changed = True
        if changed:
            self.persist()

    def broadcast_append(self) -> None:
        self.last_broadcast = time.monotonic()
        for i in range(len(self.peers)):
            if i != self.me:
                threading.Thread(target=self.replicate_to, args=(i,), daemon=True).start()

    def replicate_to(self, peer: int) -> None:
        with self.mu:
            if self._dead or self.role != LEADER:
                return
            nxt = self.next_index[peer]
            args = AppendEntriesArgs(
                term=self.current_term,
                leader_id=self.me,
                prev_log_index=nxt - 1,
                prev_log_term=self.log[nxt - 1].term,
                entries=[
                    LogEntry(term=e.term, command=bytes(e.command))
                    for e in self.log[nxt:]
                ],
                leader_commit=self.commit_index,
            )
        ok, reply = self.send_append_entries(peer, args)
        if not ok:
            return
        with self.mu:
            if reply.term > self.current_term:
                self.become_follower(reply.term)
                return
            if self.role != LEADER or self.current_term != args.term:
                return
            if reply.success:
                match = args.prev_log_index + len(args.entries)
                if match > self.match_index[peer]:
                    self.match_index[peer] = match
                if self.next_index[peer] < self.match_index[peer] + 1:
                    self.next_index[peer] = self.match_index[peer] + 1
                self.advance_commit()
                return
            back = max(reply.conflict_index, 1)
            if back < self.next_index[peer]:
                self.next_index[peer] = max(back, self.match_index[peer] + 1)
                threading.Thread(
                    target=self.replicate_to, args=(peer,), daemon=True
                ).start()

    def start(self, command: bytes) -> tuple[int, int, bool]:
        with self.mu:
            if self._dead or self.role != LEADER:
                return -1, self.current_term, False
            self.log.append(
                LogEntry(term=self.current_term, command=bytes(command))
            )
            self.persist()
            self.broadcast_append()
            return self.last_log_index(), self.current_term, True
