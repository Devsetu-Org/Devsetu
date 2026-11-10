"""Manifest records which tables make up the store."""
from __future__ import annotations
import os
from dataclasses import dataclass, field
from typing import List

FILE_NAME = "MANIFEST"
HEADER = "lsmkv-manifest v1"

class CorruptError(ValueError):
    pass

@dataclass
class State:
    next_file: int = 1
    tables: List[int] = field(default_factory=list)

def encode(s: State) -> bytes:
    lines = [HEADER, f"next {s.next_file}"]
    for t in s.tables:
        lines.append(f"table {t}")
    return ("\n".join(lines) + "\n").encode()

def load(directory: str) -> State:
    path = os.path.join(directory, FILE_NAME)
    try:
        data = open(path, "rb").read().decode()
    except FileNotFoundError:
        return State(next_file=1)
    lines = data.splitlines()
    if not lines or lines[0] != HEADER:
        raise CorruptError("manifest: corrupt")
    s = State(next_file=0, tables=[])
    for line in lines[1:]:
        if not line.strip():
            continue
        parts = line.split(" ", 1)
        if len(parts) != 2:
            raise CorruptError("manifest: corrupt")
        field, value = parts
        n = int(value)
        if field == "next":
            s.next_file = n
        elif field == "table":
            s.tables.append(n)
        else:
            raise CorruptError("manifest: corrupt")
    if s.next_file == 0:
        raise CorruptError("manifest: corrupt")
    return s

def save(directory: str, s: State) -> None:
    tmp = os.path.join(directory, FILE_NAME + ".tmp")
    # TODO(5.2): write encode(s) to tmp, fsync, close; rename over MANIFEST; sync dir.
    raise NotImplementedError("TODO(5.2): save")
