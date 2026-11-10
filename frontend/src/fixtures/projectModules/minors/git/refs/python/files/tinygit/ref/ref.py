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
    # TODO(2.1): read
    raise NotImplementedError("TODO(2.1): read")


def write(r: Repo, name: str, h: Hash) -> None:
    """Write a direct ref (hash only)."""
    # TODO(2.1): write
    raise NotImplementedError("TODO(2.1): write")

