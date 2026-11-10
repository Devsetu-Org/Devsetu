"""One document occurrence of a term."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Posting:
    doc_id: int
    tf: int
