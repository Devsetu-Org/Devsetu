"""Student-owned: compact a range of tables."""
from __future__ import annotations
import os
from typing import TYPE_CHECKING
from lsmkv.compaction import Merge
from lsmkv.sstable import create, open_table
from .db import TMP_EXT, TableRef, sync_dir, table_path

if TYPE_CHECKING:
    from .db import DB

def compact_range(d: "DB", lo: int, hi: int) -> None:
    inputs = d.tables[lo:hi]
    num = d.next_file
    d.next_file += 1
    path = table_path(d.dir, num)
    tmp = path + TMP_EXT
    children = []
    iters = []
    for inp in inputs:
        it = inp.t.new_iterator()
        children.append(it)
        iters.append(it)
    w = create(tmp, d.writer_options())
    try:
        Merge(children, w, hi == len(d.tables))
        for it in iters:
            if getattr(it, "err", None):
                raise it.err
        w.Finish()
    except Exception:
        w.abort()
        raise
    try:
        os.rename(tmp, path)
    except Exception:
        try: os.remove(tmp)
        except OSError: pass
        raise
    sync_dir(d.dir)
    t = open_table(path)
    out = TableRef(num=num, t=t)
    # size tracking optional for python minimal port
    tables = d.tables[:lo] + [out] + d.tables[hi:]
    d.save_manifest(tables)
    old = list(inputs)
    d.tables = tables
    for inp in old:
        inp.t.close()
        try: os.remove(table_path(d.dir, inp.num))
        except OSError: pass
