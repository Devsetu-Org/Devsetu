"""Recovery and the log-first commit path."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from lsmkv.wal import Record

    from .db import DB


def recover_log(d: "DB") -> None:
    """Rebuild d.mem from the log in d.dir, then open the log for appending
    with any torn tail cut off.
    """
    # TODO(2.4): replay the log at os.path.join(d.dir, WAL_NAME), applying
    # every record to d.mem with apply. Then set d.log with open_append at
    # the good offset replay returned (and d.opts.sync), so a torn tail is
    # cut off before anything new is appended.
    raise NotImplementedError("TODO(2.4): recover_log")


def commit(d: "DB", r: "Record") -> None:
    """Append r to the log and only then apply it to the memtable.

    Nothing reaches the memtable unless the append succeeded. The caller
    holds d._mu.
    """
    # TODO(2.4): append r to d.log first. Only if that succeeds, apply it to
    # d.mem. A write that failed to reach the log must not become visible.
    raise NotImplementedError("TODO(2.4): commit")
