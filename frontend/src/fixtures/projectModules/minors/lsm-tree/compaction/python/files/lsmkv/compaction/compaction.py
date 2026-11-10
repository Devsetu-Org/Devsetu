"""Merge several tables into one."""
from __future__ import annotations
from dataclasses import dataclass
from typing import List
from lsmkv.iterator import Merging
from lsmkv.memtable.skiplist import Kind

@dataclass
class Stats:
    written: int = 0
    dropped_tombstones: int = 0

def Merge(inputs, w, drop_tombstones: bool) -> Stats:
    # TODO(5.1): merge inputs; skip tombstones when drop_tombstones; Add others.
    raise NotImplementedError("TODO(5.1): Merge")
