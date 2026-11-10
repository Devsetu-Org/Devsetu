"""Student-owned: open footer/index and one-block get."""

from __future__ import annotations

from typing import TYPE_CHECKING, Optional, Tuple

from lsmkv.memtable import Result

if TYPE_CHECKING:
    from .format import Handle
    from .reader import Table


def open_table(f) -> Tuple["Table", "Handle"]:
    """Read the footer and the index block. Return (table, filter handle)."""
    # TODO(3.3): read the last FOOTER_SIZE bytes, decode them with
    # decode_footer, read the index block with t.read_block, and decode it
    # into t.index with decode_index. Return t and the filter handle.
    raise NotImplementedError("TODO(3.3): open")


def get(t: "Table", key: bytes) -> Tuple[Optional[bytes], Result]:
    """Find the one data block that can hold key and search only that block."""
    # TODO(3.3): binary-search t.index for the first block whose last_key >=
    # key; if there is none, the key is MISSING. Read that one block, decode
    # it, and scan its entries: an equal key answers FOUND or DELETED, a
    # greater key means MISSING.
    raise NotImplementedError("TODO(3.3): get")
