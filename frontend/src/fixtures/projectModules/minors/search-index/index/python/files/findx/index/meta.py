"""Engine and catalog metadata."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List

from findx.postings import Map, Posting, Segment

catalog_name = "catalog.json"


@dataclass
class Meta:
    ext_id: str  # caller-facing document id
    length: int  # token count after analyze


@dataclass
class Engine:
    dir: str
    next_doc: int = 0
    docs: Dict[int, Meta] = field(default_factory=dict)
    ext_to_id: Dict[str, int] = field(default_factory=dict)
    mem: Map = field(default_factory=Map)
    buf_lens: Dict[int, int] = field(default_factory=dict)
    seg_names: List[str] = field(default_factory=list)
    segs: List[Segment] = field(default_factory=list)

    def add(self, doc_id: str, text: str) -> None:
        from findx.index import add as add_mod

        add_mod.add(self, doc_id, text)

    def flush(self) -> None:
        from findx.index import flush as flush_mod

        flush_mod.flush(self)

    def write_catalog(self) -> None:
        from findx.index.catalog_io import write_catalog

        write_catalog(self)

    def postings(self, term: str) -> List[Posting]:
        from findx.index.lookup import postings

        return postings(self, term)

    def doc(self, internal_id: int):
        from findx.index.lookup import doc

        return doc(self, internal_id)

    def num_docs(self) -> int:
        from findx.index.lookup import num_docs

        return num_docs(self)

    def avg_dl(self) -> float:
        from findx.index.lookup import avg_dl

        return avg_dl(self)

    def df(self, term: str) -> int:
        from findx.index.lookup import df

        return df(self, term)

    def ext_id(self, internal_id: int) -> str:
        from findx.index.lookup import ext_id

        return ext_id(self, internal_id)
