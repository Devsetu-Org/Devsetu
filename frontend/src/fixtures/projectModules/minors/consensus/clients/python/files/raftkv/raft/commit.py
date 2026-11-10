"""Commit and apply."""

from __future__ import annotations

from .types import LEADER, LogEntry


class CommitMixin:
    def advance_commit(self) -> None:
        if self.role != LEADER:
            return
        for n in range(self.last_log_index(), self.commit_index, -1):
            if self.log[n].term != self.current_term:
                return
            replicas = 1
            for i in range(len(self.peers)):
                if i != self.me and self.match_index[i] >= n:
                    replicas += 1
            if replicas >= self.majority():
                self.commit_index = n
                self.apply_cond.notify_all()
                return

    def follower_advance_commit(self, leader_commit: int, last_new: int) -> None:
        c = min(leader_commit, last_new)
        if c > self.commit_index:
            self.commit_index = c
            self.apply_cond.notify_all()

    def apply_loop(self) -> None:
        self.mu.acquire()
        while not self._dead:
            if self.last_applied >= self.commit_index:
                self.apply_cond.wait()
                continue
            first = self.last_applied + 1
            batch = [
                LogEntry(term=e.term, command=bytes(e.command))
                for e in self.log[first : self.commit_index + 1]
            ]
            self.last_applied = self.commit_index
            self.mu.release()
            try:
                for k, e in enumerate(batch):
                    with self.mu:
                        dead = self._dead
                    if dead:
                        break
                    if self.sm is not None:
                        self.sm.apply(first + k, e.command)
            finally:
                self.mu.acquire()
        self.mu.release()
