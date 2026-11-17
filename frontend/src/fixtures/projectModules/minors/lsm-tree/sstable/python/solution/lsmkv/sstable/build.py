"""Student-owned: fill data blocks, cut them, write index + footer."""

from __future__ import annotations

import os
from typing import TYPE_CHECKING, Optional

from lsmkv.memtable.skiplist import Kind

from .format import OutOfOrderError, append_entry, append_index_entry, encode_footer

if TYPE_CHECKING:
    from .format import Handle
    from .writer import Writer


def add(w: "Writer", kind: Kind, key: bytes, value: Optional[bytes]) -> None:
    if w.entries > 0 and key <= bytes(w.last_key):
        raise OutOfOrderError("sstable: keys must be added in strictly increasing order")
    append_entry(w.block, kind, key, value)
    w.last_key[:] = key
    w.entries += 1
    if len(w.block) >= w.opts.block_size:
        flush_block(w)


def flush_block(w: "Writer") -> None:
    if len(w.block) == 0:
        return
    h = w.write_block(bytes(w.block))
    append_index_entry(w.index, bytes(w.last_key), h)
    del w.block[:]


def finish(w: "Writer", filter_h: "Handle") -> None:
    index_h = w.write_block(bytes(w.index))
    w.f.write(encode_footer(filter_h, index_h))
    w.f.flush()
    os.fsync(w.f.fileno())
    w.f.close()
