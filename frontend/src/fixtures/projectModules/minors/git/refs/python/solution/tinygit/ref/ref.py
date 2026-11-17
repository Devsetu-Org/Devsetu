"""Direct refs."""
from __future__ import annotations

import os

from tinygit.object.hash import Hash, parse_hex
from tinygit.repo import Repo


def safe_path(r: Repo, name: str) -> str:
    name = name.lstrip("/")
    if not name or ".." in name:
        raise ValueError(f"ref: bad name {name!r}")
    return os.path.join(r.git_dir(), name)


def read(r: Repo, name: str) -> Hash:
    """Read a ref file relative to the git dir (e.g. refs/heads/main)."""
    path = safe_path(r, name)
    with open(path, "r", encoding="utf-8") as f:
        s = f.read().strip()
    return parse_hex(s)


def write(r: Repo, name: str, h: Hash) -> None:
    """Write a direct ref (hash only)."""
    path = safe_path(r, name)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(h.hex() + "\n")
    os.rename(tmp, path)
