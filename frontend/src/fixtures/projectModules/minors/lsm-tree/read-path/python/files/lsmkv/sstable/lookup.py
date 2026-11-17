"""Student-owned: open footer/index and one-block get."""

from __future__ import annotations

import bisect
import os
from typing import List, Optional, Tuple

from lsmkv.memtable import Result
from lsmkv.memtable.skiplist import Kind

from .format import FOOTER_SIZE, CorruptError, decode_block, decode_footer, decode_index
from .reader import Table


def open_table(f) -> Tuple[Table, object]:
    st = os.fstat(f.fileno())
    if st.st_size < FOOTER_SIZE:
        raise CorruptError("sstable: corrupt table")
    t = Table()
    t.f = f
    t.size = st.st_size
    f.seek(t.size - FOOTER_SIZE)
    footer = f.read(FOOTER_SIZE)
    filt, index_h = decode_footer(footer)
    raw = t.read_block(index_h)
    t.index = decode_index(raw)
    return t, filt


def get(t: Table, key: bytes) -> Tuple[Optional[bytes], Result]:
    # First index entry whose last_key >= key.
    keys = [e.last_key for e in t.index]
    i = bisect.bisect_left(keys, key)
    if i == len(t.index):
        return None, Result.MISSING
    raw = t.read_block(t.index[i].handle)
    entries = decode_block(raw)
    for e in entries:
        if e.key == key:
            if e.kind is Kind.TOMBSTONE:
                return None, Result.DELETED
            return e.value, Result.FOUND
        if e.key > key:
            return None, Result.MISSING
    return None, Result.MISSING
