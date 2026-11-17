"""Student-owned: flush the memtable to a new SSTable."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .db import DB


def flush(d: "DB") -> None:
    """Write the memtable to the next table file, make it live, start a fresh log.

    The caller holds d._mu.
    """
    if len(d.mem) == 0:
        return
    num = d.next_file
    d.next_file += 1
    from .db import TMP_EXT, table_path

    path = table_path(d.dir, num)
    tmp = path + TMP_EXT
    # TODO(3.4)
    raise NotImplementedError("TODO(3.4)")
