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
    # TODO(3.2): If e.mem has no terms, return. Otherwise create
    # segment-%06d.fx under e.dir (len(e.seg_names) as the number), write_segment,
    # open_segment, append to e.seg_names / e.segs, clear the map, reset e.buf_lens,
    # and call e.write_catalog().
    _ = os.path.join
    _ = open_segment
    _ = write_segment
    _ = e
    raise NotImplementedError("TODO(3.2): Engine.flush")
