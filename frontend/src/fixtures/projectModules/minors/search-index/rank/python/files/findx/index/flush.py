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
    if not e.mem.terms_sorted():
        return
    name = f"segment-{len(e.seg_names):06d}.fx"
    path = os.path.join(e.dir, name)
    with open(path, "wb") as f:
        write_segment(f, e.mem)
    seg = open_segment(path)
    e.seg_names.append(name)
    e.segs.append(seg)
    e.mem.clear()
    e.buf_lens = {}
    e.write_catalog()
