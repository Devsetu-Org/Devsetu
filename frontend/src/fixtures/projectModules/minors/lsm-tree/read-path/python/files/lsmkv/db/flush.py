"""Student-owned: flush the memtable to a new SSTable."""

from __future__ import annotations

import os
from typing import TYPE_CHECKING

from lsmkv.memtable import Memtable
from lsmkv.sstable import create, open_table
from lsmkv.wal import create as wal_create

from .db import TMP_EXT, TableRef, sync_dir, table_path

if TYPE_CHECKING:
    from .db import DB


def flush(d: "DB") -> None:
    if len(d.mem) == 0:
        return
    num = d.next_file
    d.next_file += 1
    path = table_path(d.dir, num)
    tmp = path + TMP_EXT

    w = create(tmp, d.writer_options())
    try:
        it = d.mem.new_iterator()
        it.seek_to_first()
        while it.valid():
            w.Add(it.kind(), it.key(), it.value())
            it.next()
        w.Finish()
    except Exception:
        w.abort()
        raise

    try:
        os.rename(tmp, path)
    except Exception:
        try:
            os.remove(tmp)
        except OSError:
            pass
        raise
    sync_dir(d.dir)
    t = open_table(path)
    try:
        d.add_table(TableRef(num=num, t=t))
    except Exception:
        t.close()
        raise

    d.log.close()
    d.log = wal_create(os.path.join(d.dir, "wal.log"), d.opts.sync)
    d.mem = Memtable()
