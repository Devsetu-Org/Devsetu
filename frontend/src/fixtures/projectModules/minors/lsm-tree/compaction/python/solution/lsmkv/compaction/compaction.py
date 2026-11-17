"""Merge several tables into one."""
from __future__ import annotations
from dataclasses import dataclass
from lsmkv.iterator import Merging
from lsmkv.memtable.skiplist import Kind

@dataclass
class Stats:
    written: int = 0
    dropped_tombstones: int = 0

def Merge(inputs, w, drop_tombstones: bool) -> Stats:
    st = Stats()
    m = Merging(*inputs)
    m.seek_to_first()
    while m.valid():
        if m.kind() is Kind.TOMBSTONE and drop_tombstones:
            st.dropped_tombstones += 1
            m.next()
            continue
        w.Add(m.kind(), m.key(), m.value())
        st.written += 1
        m.next()
    return st
