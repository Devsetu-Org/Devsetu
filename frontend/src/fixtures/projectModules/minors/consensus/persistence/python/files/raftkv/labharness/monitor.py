"""Background safety monitor."""

from __future__ import annotations

import time

from raftkv import raft


class MonitorMixin:
    def _monitor(self) -> None:
        try:
            round_ = 0
            while not self._stop.wait(0.008):
                states = []
                for i in range(self.n):
                    if self.Up(i):
                        states.append(self.Raft(i).debug_state())
                self._check_leaders(states)
                if round_ % 4 == 0:
                    self._check_log_matching(states)
                round_ += 1
        finally:
            self._done.set()

    def _check_leaders(self, states: list[raft.State]) -> None:
        with self._mu:
            for st in states:
                if st.role != raft.LEADER:
                    continue
                prev = self.leaders.get(st.term)
                if prev is not None and prev != st.id:
                    self._report(
                        f"SAFETY: nodes {prev} and {st.id} were both leader of term {st.term}"
                    )
                self.leaders[st.term] = st.id

    def _check_log_matching(self, states: list[raft.State]) -> None:
        for a in range(len(states)):
            for b in range(a + 1, len(states)):
                la, lb = states[a].log, states[b].log
                top = min(len(la), len(lb))
                match = 0
                for k in range(top, 0, -1):
                    if la[k - 1].term == lb[k - 1].term:
                        match = k
                        break
                for k in range(1, match + 1):
                    if (
                        la[k - 1].term != lb[k - 1].term
                        or la[k - 1].command != lb[k - 1].command
                    ):
                        self._report(
                            f"SAFETY: logs of nodes {states[a].id} and {states[b].id} "
                            f"agree at index {match} (term {la[match - 1].term}) "
                            f"but differ at index {k}"
                        )
                        return
