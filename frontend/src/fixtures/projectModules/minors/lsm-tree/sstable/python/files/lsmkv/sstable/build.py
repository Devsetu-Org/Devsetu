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
    # TODO(3.1)
    raise NotImplementedError("TODO(3.1)")


def flush_block(w: "Writer") -> None:
    """Write the current data block and record it in the index."""
    # TODO(3.1)
    raise NotImplementedError("TODO(3.1)")


def finish(w: "Writer", filter_h: "Handle") -> None:
    """Write the index block and the footer, then flush, sync, and close."""
    # TODO(3.2)
    raise NotImplementedError("TODO(3.2)")
