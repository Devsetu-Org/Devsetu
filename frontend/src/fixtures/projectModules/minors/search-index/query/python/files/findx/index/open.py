"""Open or create a directory-backed index."""

from __future__ import annotations

import json
import os

from findx.index.meta import Engine, Meta, catalog_name
from findx.postings import Map, open_segment


def open_index(dir_path: str) -> Engine:
    """Load an index from dir, creating the directory and an empty catalog when missing."""
    os.makedirs(dir_path, exist_ok=True)
    e = Engine(
        dir=dir_path,
        next_doc=0,
        docs={},
        ext_to_id={},
        mem=Map(),
        buf_lens={},
        seg_names=[],
        segs=[],
    )
    path = os.path.join(dir_path, catalog_name)
    if not os.path.exists(path):
        e.write_catalog()
        return e
    with open(path, "r", encoding="utf-8") as f:
        cat = json.load(f)
    e.next_doc = int(cat["next_doc"])
    for d in cat.get("docs", []):
        e.docs[int(d["id"])] = Meta(ext_id=d["ext_id"], length=int(d["len"]))
        e.ext_to_id[d["ext_id"]] = int(d["id"])
    for name in cat.get("segments", []):
        seg = open_segment(os.path.join(dir_path, name))
        e.seg_names.append(name)
        e.segs.append(seg)
    return e
