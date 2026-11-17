"""In-memory inverted index: term → postings sorted by doc_id."""

from __future__ import annotations

import bisect
from typing import Dict, List

from findx.postings.posting import Posting


class Map:
    def __init__(self) -> None:
        self.terms: Dict[str, List[Posting]] = {}

    def add(self, term: str, doc_id: int, tf: int) -> None:
        """Record that term appears in doc_id with frequency tf.

        If the term already has an entry for doc_id, TF is replaced (not summed).
        Lists stay sorted by doc_id.
        """
        if self.terms is None:
            self.terms = {}
        lst = self.terms.setdefault(term, [])
        ids = [p.doc_id for p in lst]
        i = bisect.bisect_left(ids, doc_id)
        if i < len(lst) and lst[i].doc_id == doc_id:
            lst[i].tf = tf
            return
        lst.insert(i, Posting(doc_id=doc_id, tf=tf))

    def terms_sorted(self) -> List[str]:
        return sorted(self.terms.keys())

    def postings(self, term: str) -> List[Posting]:
        return self.terms.get(term, [])

    def clear(self) -> None:
        self.terms = {}
