"""Student-owned: range scans over memtable + tables."""

from __future__ import annotations

from typing import TYPE_CHECKING, Callable, List, Optional

from lsmkv.iterator import Merging
from lsmkv.memtable.skiplist import Kind

if TYPE_CHECKING:
    from .db import DB


def scan(d: "DB", start: Optional[bytes], end: Optional[bytes], fn: Callable[[bytes, bytes], bool]) -> None:
    children = [d.mem.new_iterator()]
    table_iters = []
    for tb in d.tables:
        it = tb.t.new_iterator()
        children.append(it)
        table_iters.append(it)
    m = Merging(*children)
    if start is None:
        m.seek_to_first()
    else:
        m.seek(start)
    while m.valid():
        if end is not None and m.key() >= end:
            break
        if m.kind() is Kind.TOMBSTONE:
            m.next()
            continue
        if not fn(m.key(), m.value() or b""):
            break
        m.next()
    for it in table_iters:
        if getattr(it, "err", None):
            raise it.err
