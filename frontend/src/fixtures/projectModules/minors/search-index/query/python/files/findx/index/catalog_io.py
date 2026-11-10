"""Persist catalog.json."""

from __future__ import annotations

import json
import os
from typing import TYPE_CHECKING

from findx.index.meta import catalog_name

if TYPE_CHECKING:
    from findx.index.meta import Engine


def write_catalog(e: "Engine") -> None:
    docs = []
    for doc_id in sorted(e.docs.keys()):
        m = e.docs[doc_id]
        docs.append({"id": doc_id, "ext_id": m.ext_id, "len": m.length})
    cat = {
        "next_doc": e.next_doc,
        "docs": docs,
        "segments": list(e.seg_names),
    }
    path = os.path.join(e.dir, catalog_name)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(cat, f, indent=2)
        f.write("\n")
