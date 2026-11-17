"""Flush the in-memory postings as a new segment file."""

from __future__ import annotations

import os
from typing import TYPE_CHECKING

from findx.postings import open_segment, write_segment

if TYPE_CHECKING:
    from findx.index.meta import Engine


def flush(e: "Engine") -> None:
    """Write a new segment, open it, clear the buffer, persist catalog.json.

    Flush with an empty buffer is a no-op success.
    """
    # TODO(3.2)
    _ = os.path.join
    _ = open_segment
    _ = write_segment
    _ = e
    raise NotImplementedError("TODO(3.2)")
