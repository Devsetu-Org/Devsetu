"""Parse a boolean query string into AND-groups separated by OR."""

from __future__ import annotations

from dataclasses import dataclass
from typing import List

from findx.analyze import analyze


@dataclass
class Query:
    """Groups are OR'd; terms inside a group are AND'd."""

    groups: List[List[str]]


def parse(q: str) -> Query:
    """Analyze a query string.

    The literal token OR (ASCII, surrounded by whitespace when between terms)
    splits OR-groups. Each group is analyzed with the same analyzer as documents;
    empty groups after analysis are dropped.
    """
    parts = _split_or(q)
    groups: List[List[str]] = []
    for part in parts:
        terms = analyze(part)
        if not terms:
            continue
        groups.append(terms)
    return Query(groups=groups)


def _split_or(q: str) -> List[str]:
    fields = q.split()
    if not fields:
        return []
    parts: List[str] = []
    cur: List[str] = []

    def flush() -> None:
        if cur:
            parts.append(" ".join(cur))
            cur.clear()

    for f in fields:
        if f == "OR":
            flush()
            continue
        cur.append(f)
    flush()
    return parts
