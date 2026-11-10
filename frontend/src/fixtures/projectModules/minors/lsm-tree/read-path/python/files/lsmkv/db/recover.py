"""Recovery and the log-first commit path."""

from __future__ import annotations

import os
from typing import TYPE_CHECKING

from lsmkv.wal import open_append, replay

from .db import WAL_NAME, apply

if TYPE_CHECKING:
    from lsmkv.wal import Record

    from .db import DB


def recover_log(d: "DB") -> None:
    """Rebuild d.mem from the log in d.dir, then open the log for appending
    with any torn tail cut off.
    """
    path = os.path.join(d.dir, WAL_NAME)

    def on_record(r: "Record") -> None:
        apply(d.mem, r)

    good = replay(path, on_record)
    d.log = open_append(path, good, d.opts.sync)


def commit(d: "DB", r: "Record") -> None:
    """Append r to the log and only then apply it to the memtable.

    Nothing reaches the memtable unless the append succeeded. The caller
    holds d._mu.
    """
    assert d.log is not None
    d.log.append(r)
    apply(d.mem, r)
