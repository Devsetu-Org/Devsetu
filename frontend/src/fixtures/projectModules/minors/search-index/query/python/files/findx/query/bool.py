"""Boolean retrieval over sorted posting lists."""

from __future__ import annotations

from typing import List, Protocol, Sequence

from findx.postings import Posting
from findx.query.parse import Query


def intersect(lists: Sequence[Sequence[Posting]]) -> List[int]:
    """Return doc ids that appear in every list. Lists must be sorted by doc_id."""
    # TODO(4.2): If lists is empty or any list is empty, return []. Convert each
    # list to doc ids and pairwise intersect with two pointers (advance the
    # smaller id; on equal, emit and advance both).
    raise NotImplementedError("TODO(4.2): intersect")


def union(lists: Sequence[Sequence[Posting]]) -> List[int]:
    """Return doc ids that appear in any list. Lists must be sorted by doc_id."""
    # TODO(4.3): Pairwise union with two pointers. On equal ids emit once.
    raise NotImplementedError("TODO(4.3): union")


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
