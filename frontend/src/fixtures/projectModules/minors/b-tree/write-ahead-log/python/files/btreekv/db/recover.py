"""Recover and commit — student task 3.4."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .db import DB
    from .txn import Txn


def recover_log(self: DB) -> None:
    # TODO(3.4): path = os.path.join(self.dir, WAL_NAME). Call wal.replay with a
    # callback that collects records into a pending batch. On Kind.COMMIT,
    # apply_records(self, pending), clear pending, remember end as last commit.
    # Finally self.log = open_append(path, last_commit, self.opts.sync).
    raise NotImplementedError("TODO(3.4): recover_log")


def commit(self: DB, t: Txn) -> None:
    # TODO(3.4): recs = t.records(); start = self.log.size(). Append the batch.
    # On failure, rewind(start) and re-raise. Only then apply_records(self, recs).
    raise NotImplementedError("TODO(3.4): commit")
