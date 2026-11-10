"""Boolean retrieval over sorted posting lists."""

from __future__ import annotations

from typing import List, Protocol, Sequence

from findx.postings import Posting
from findx.query.parse import Query


def intersect(lists: Sequence[Sequence[Posting]]) -> List[int]:
    """Return doc ids that appear in every list. Lists must be sorted by doc_id."""
    if not lists:
        return []
    for lst in lists:
        if not lst:
            return []
    cur = _doc_ids(lists[0])
    for i in range(1, len(lists)):
        cur = _intersect_two(cur, _doc_ids(lists[i]))
        if not cur:
            return []
    return cur


def union(lists: Sequence[Sequence[Posting]]) -> List[int]:
    """Return doc ids that appear in any list. Lists must be sorted by doc_id."""
    if not lists:
        return []
    cur = _doc_ids(lists[0])
    for i in range(1, len(lists)):
        cur = _union_two(cur, _doc_ids(lists[i]))
    return cur


def _doc_ids(lst: Sequence[Posting]) -> List[int]:
    return [p.doc_id for p in lst]


def _intersect_two(a: List[int], b: List[int]) -> List[int]:
    out: List[int] = []
    i = j = 0
    while i < len(a) and j < len(b):
        if a[i] == b[j]:
            out.append(a[i])
            i += 1
            j += 1
        elif a[i] < b[j]:
            i += 1
        else:
            j += 1
    return out


def _union_two(a: List[int], b: List[int]) -> List[int]:
    out: List[int] = []
    i = j = 0
    while i < len(a) and j < len(b):
        if a[i] == b[j]:
            out.append(a[i])
            i += 1
            j += 1
        elif a[i] < b[j]:
            out.append(a[i])
            i += 1
        else:
            out.append(b[j])
            j += 1
    out.extend(a[i:])
    out.extend(b[j:])
    return out


class PostingSource(Protocol):
    def postings(self, term: str) -> List[Posting]: ...


def docs(src: PostingSource, q: Query) -> List[int]:
    """Return matching internal document ids for q."""
    if not q.groups:
        return []
    group_lists: List[List[Posting]] = []
    for terms in q.groups:
        lists = [src.postings(term) for term in terms]
        ids = intersect(lists)
        synth = [Posting(doc_id=i, tf=1) for i in ids]
        group_lists.append(synth)
    if len(group_lists) == 1:
        return _doc_ids(group_lists[0])
    return union(group_lists)
