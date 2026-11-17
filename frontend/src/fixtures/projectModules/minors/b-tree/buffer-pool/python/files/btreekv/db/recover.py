"""Recover and commit — student task 3.4."""

from __future__ import annotations

import os
from typing import TYPE_CHECKING

from btreekv.wal import Kind, open_append, replay
from btreekv.db.apply import apply_records

if TYPE_CHECKING:
    from .db import DB
    from .txn import Txn


def recover_log(self: DB) -> None:
    path = os.path.join(self.dir, "wal.log")
    pending = []
    committed = 0

    def on_rec(r, end: int) -> None:
        nonlocal committed, pending
        pending.append(r)
        if r.kind != Kind.COMMIT:
            return
        apply_records(self, pending)
        pending = []
        committed = end

    replay(path, on_rec)
    self.log = open_append(path, committed, self.opts.sync)


def commit(self: DB, t: Txn) -> None:
    recs = t.records()
    start = self.log.size()
    try:
        self.log.append(*recs)
    except Exception:
        self.log.rewind(start)
        raise
    apply_records(self, recs)
