"""Public findx API: Open / Add / Flush (chapters 3–4)."""

from __future__ import annotations

from findx.index import open_index
from findx.index.meta import Engine


class Index:
    def __init__(self, eng: Engine) -> None:
        self.eng = eng

    def add(self, doc_id: str, text: str) -> None:
        self.eng.add(doc_id, text)

    def flush(self) -> None:
        self.eng.flush()


def open_index_dir(dir_path: str) -> Index:
    return Index(open_index(dir_path))
