"""Student-owned: fill data blocks, cut them, write index + footer."""

from __future__ import annotations

from typing import TYPE_CHECKING, Optional

from lsmkv.memtable.skiplist import Kind

if TYPE_CHECKING:
    from .format import Handle
    from .writer import Writer


def add(w: "Writer", kind: Kind, key: bytes, value: Optional[bytes]) -> None:
    """Append one entry to the current data block and cut once it reaches the
    block size.
    """
    # TODO(3.1): reject a key that is not greater than w.last_key (unless this
    # is the first entry) with OutOfOrderError. Append the entry to w.block
    # with append_entry, remember the key in w.last_key (copy it), count it in
    # w.entries, and cut the block with flush_block once it reaches
    # w.opts.block_size bytes.
    raise NotImplementedError("TODO(3.1): add")


def flush_block(w: "Writer") -> None:
    """Write the current data block and record it in the index."""
    # TODO(3.1): do nothing for an empty block. Otherwise write it with
    # write_block, append an index entry (w.last_key and the handle) to
    # w.index with append_index_entry, and empty w.block for the next one.
    raise NotImplementedError("TODO(3.1): flush_block")


def finish(w: "Writer", filter_h: "Handle") -> None:
    """Write the index block and the footer, then flush, sync, and close."""
    # TODO(3.2): write w.index as a block with write_block. Write the footer
    # with encode_footer(filter_h, index). Then flush w.f, fsync, and close it.
    raise NotImplementedError("TODO(3.2): finish")
