"""Meta and commit record helpers."""

from __future__ import annotations

import struct

from .record import Kind, Record


def meta_record(root: int, page_count: int, free_head: int) -> Record:
    data = bytearray(12)
    struct.pack_into("<III", data, 0, root, page_count, free_head)
    return Record(kind=Kind.META, data=bytes(data))


def commit_record() -> Record:
    return Record(kind=Kind.COMMIT)


def unpack_meta(r: Record) -> tuple[int, int, int]:
    if r.kind != Kind.META or len(r.data) != 12:
        raise ValueError("wal: not a meta record")
    return struct.unpack_from("<III", r.data, 0)
