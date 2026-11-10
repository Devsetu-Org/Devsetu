"""Public findx API: Open / Add / Flush / Search (chapter 5)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import List

from findx.index import open_index
from findx.index.meta import Engine


@dataclass
class Hit:
    id: str
    score: float


class Index:
    def __init__(self, eng: Engine) -> None:
        self.eng = eng

    def add(self, doc_id: str, text: str) -> None:
        self.eng.add(doc_id, text)

    def flush(self) -> None:
        self.eng.flush()

    def search(self, q: str, k: int) -> List[Hit]:
        from findx.query import docs, parse
        from findx.rank import Hit as RankHit
        from findx.rank import collect_stats, score, top_k

        parsed = parse(q)
        ids = docs(self.eng, parsed)
        if not ids:
            return []

        terms: List[str] = []
        seen = set()
        for g in parsed.groups:
            for t in g:
                if t in seen:
                    continue
                seen.add(t)
                terms.append(t)
        st, df = collect_stats(self.eng, terms)

        def tf_for(term: str, doc_id: int) -> int:
            for p in self.eng.postings(term):
                if p.doc_id == doc_id:
                    return p.tf
                if p.doc_id > doc_id:
                    break
            return 0

        raw: List[RankHit] = []
        for internal in ids:
            meta, ok = self.eng.doc(internal)
            if not ok or meta is None:
                continue
            total = 0.0
            for term in terms:
                tf = tf_for(term, internal)
                if tf == 0:
                    continue
                total += score(tf, meta.length, df[term], st)
            raw.append(RankHit(doc_id=internal, score=total))
        top = top_k(raw, k)
        return [Hit(id=self.eng.ext_id(h.doc_id), score=h.score) for h in top]


def open_index_dir(dir_path: str) -> Index:
    return Index(open_index(dir_path))
