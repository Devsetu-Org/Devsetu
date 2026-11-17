"""Open or create a directory-backed index."""

from __future__ import annotations

import json
import os

from findx.index.meta import Engine, Meta, catalog_name
from findx.postings import Map, open_segment


def open_index(dir_path: str) -> Engine:
    """Load an index from dir, creating the directory and an empty catalog when missing."""
    # TODO(3.3)
    _ = json
    _ = os
    _ = Engine
    _ = Meta
    _ = catalog_name
    _ = Map
    _ = open_segment
    _ = dir_path
    raise NotImplementedError("TODO(3.3)")
