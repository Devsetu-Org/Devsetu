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
    cp = sorted(idx.entries, key=lambda e: e.path)
    lines = [f"{MAGIC} {VERSION}\n"]
    for e in cp:
        if not e.path or "\n" in e.path or "\t" in e.path:
            raise ValueError(f"index: bad path {e.path!r}")
        lines.append(f"{e.path}\t{e.mode}\t{e.hash.hex()}\n")
    return "".join(lines).encode()


def decode(data: bytes) -> Index:
    """Parse an index file body."""
    text = data.decode()
    lines = text.splitlines()
    if not lines:
        raise ValueError("index: empty")
    parts = lines[0].split()
    if len(parts) != 2 or parts[0] != MAGIC:
        raise ValueError(f"index: bad header {lines[0]!r}")
    ver = int(parts[1])
    if ver != VERSION:
        raise ValueError(f"index: unsupported version {ver}")
    entries: list[Entry] = []
    for line in lines[1:]:
        if not line:
            continue
        bits = line.split("\t")
        if len(bits) != 3:
            raise ValueError(f"index: bad line {line!r}")
        entries.append(Entry(path=bits[0], mode=bits[1], hash=parse_hex(bits[2])))
    return Index(entries=entries)


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
