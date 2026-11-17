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
    # TODO(2.4)
    raise NotImplementedError("TODO(2.4)")


def commit(d: "DB", r: "Record") -> None:
    """Append r to the log and only then apply it to the memtable.

    Nothing reaches the memtable unless the append succeeded. The caller
    holds d._mu.
    """
    # TODO(2.4)
    raise NotImplementedError("TODO(2.4)")
