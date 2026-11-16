"""Student-owned: open footer/index and one-block get."""

from __future__ import annotations

from typing import TYPE_CHECKING, Optional, Tuple

from lsmkv.memtable import Result

if TYPE_CHECKING:
    from .format import Handle
    from .reader import Table


def open_table(f) -> Tuple["Table", "Handle"]:
    """Read the footer and the index block. Return (table, filter handle)."""
    # TODO(3.3)
    raise NotImplementedError("TODO(3.3)")


def get(t: "Table", key: bytes) -> Tuple[Optional[bytes], Result]:
    """Find the one data block that can hold key and search only that block."""
    # TODO(3.3)
    raise NotImplementedError("TODO(3.3)")
