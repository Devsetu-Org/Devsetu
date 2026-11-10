"""Symbolic and detached HEAD."""
from __future__ import annotations

import os
from dataclasses import dataclass, field

from tinygit.object.hash import ZERO, Hash, parse_hex
from tinygit.ref.ref import read
from tinygit.repo import Repo


@dataclass
class HEAD:
    symbolic: str = ""  # e.g. refs/heads/main, empty if detached
    hash: Hash = field(default_factory=lambda: ZERO)


def read_head(r: Repo) -> HEAD:
    """Read .tinygit/HEAD."""
    path = os.path.join(r.git_dir(), "HEAD")
    with open(path, "r", encoding="utf-8") as f:
        s = f.read().strip()
    if s.startswith("ref: "):
        return HEAD(symbolic=s[len("ref: ") :].strip())
    try:
        return HEAD(hash=parse_hex(s))
    except ValueError as e:
        raise ValueError(f"ref: bad HEAD: {e}") from e


def resolve_head(r: Repo) -> Hash:
    """Return the commit hash HEAD currently names."""
    h = read_head(r)
    if h.symbolic:
        return read(r, h.symbolic)
    return h.hash


def write_symbolic_head(r: Repo, name: str) -> None:
    name = name.lstrip("/")
    if not name or ".." in name:
        raise ValueError(f"ref: bad HEAD target {name!r}")
    with open(os.path.join(r.git_dir(), "HEAD"), "w", encoding="utf-8") as f:
        f.write(f"ref: {name}\n")


def write_detached_head(r: Repo, h: Hash) -> None:
    with open(os.path.join(r.git_dir(), "HEAD"), "w", encoding="utf-8") as f:
        f.write(h.hex() + "\n")
