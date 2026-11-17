"""Apply logged records to the store."""

from __future__ import annotations

from typing import TYPE_CHECKING

from btreekv.pager.page import PAGE_SIZE, Meta
from btreekv.wal.meta import unpack_meta
from btreekv.wal.record import Kind, Record

if TYPE_CHECKING:
    from .db import DB


def apply_records(d: "DB", recs: list[Record]) -> None:
    for r in recs:
        if r.kind == Kind.PAGE:
            buf = bytearray(PAGE_SIZE)
            buf[: len(r.data)] = r.data
            d.store.write_page(r.page, buf)
        elif r.kind == Kind.META:
            root, count, free = unpack_meta(r)
            d.store.set_meta(Meta(root=root, page_count=count, free_head=free))
