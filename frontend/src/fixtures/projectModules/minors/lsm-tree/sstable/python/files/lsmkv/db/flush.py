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
    # TODO(3.4): write the memtable to a table and make it live, in this order:
    #  1. create(tmp, d.writer_options()) and Add every entry from d.mem's
    #     iterator, tombstones included. On error, abort.
    #  2. Finish, os.rename(tmp, path), then sync_dir(d.dir).
    #  3. open_table(path) and hand it to d.add_table(TableRef(num=num, t=t)),
    #     which makes it the newest table. Close it if add_table fails.
    #  4. Only now: close d.log, start a fresh one with create, and replace
    #     d.mem with an empty memtable.
    raise NotImplementedError("TODO(3.4): flush")
