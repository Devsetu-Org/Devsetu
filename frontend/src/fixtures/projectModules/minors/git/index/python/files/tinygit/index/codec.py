"""Index codec: TINYIDX text format."""
from __future__ import annotations

import os
from dataclasses import dataclass, field

from tinygit.object.hash import Hash, parse_hex

MAGIC = "TINYIDX"
VERSION = 1


@dataclass
class Entry:
    path: str
    mode: str
    hash: Hash


@dataclass
class Index:
    entries: list[Entry] = field(default_factory=list)

    def get(self, path: str) -> Entry | None:
        for e in self.entries:
            if e.path == path:
                return e
        return None

    def set(self, e: Entry) -> None:
        for i, cur in enumerate(self.entries):
            if cur.path == e.path:
                self.entries[i] = e
                return
        self.entries.append(e)

    def remove(self, path: str) -> None:
        self.entries = [e for e in self.entries if e.path != path]


def encode(idx: Index) -> bytes:
    """Serialize the index to the custom text format."""
    # TODO(3.1): encode
    raise NotImplementedError("TODO(3.1): encode")


def decode(data: bytes) -> Index:
    """Parse an index file body."""
    # TODO(3.1): decode
    raise NotImplementedError("TODO(3.1): decode")


def load(path: str) -> Index:
    try:
        with open(path, "rb") as f:
            return decode(f.read())
    except FileNotFoundError:
        return Index()


def save(path: str, idx: Index) -> None:
    data = encode(idx)
    tmp = path + ".tmp"
    with open(tmp, "wb") as f:
        f.write(data)
    os.rename(tmp, path)
