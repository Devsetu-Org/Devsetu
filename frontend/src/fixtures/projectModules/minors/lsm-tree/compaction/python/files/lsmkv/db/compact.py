"""Student-owned: compact a range of tables."""
from __future__ import annotations
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from .db import DB

def compact_range(d: "DB", lo: int, hi: int) -> None:
    # TODO(5.3): merge d.tables[lo:hi] into one new table; commit manifest; delete inputs.
    raise NotImplementedError("TODO(5.3): compact_range")
