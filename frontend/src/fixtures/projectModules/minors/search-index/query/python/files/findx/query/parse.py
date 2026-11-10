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
    # TODO(4.1): Split q on whitespace into fields. Treat a field equal to "OR"
    # as a group separator (not analyzed). Join each group's fields with spaces,
    # run analyze, skip empty results, and return Query(groups=...).
    _ = analyze
    _ = q
    raise NotImplementedError("TODO(4.1): parse")
