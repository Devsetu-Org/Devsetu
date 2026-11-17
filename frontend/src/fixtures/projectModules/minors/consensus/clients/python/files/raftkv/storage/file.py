"""File-backed Store."""

from __future__ import annotations

import os
from pathlib import Path

FILE_NAME = "raft-state"


class File:
    def __init__(self, dir: str | Path) -> None:
        self.dir = Path(dir)
        self.dir.mkdir(parents=True, exist_ok=True)

    def temp_path(self) -> Path:
        return self.dir / f"{FILE_NAME}.tmp"

    def final_path(self) -> Path:
        return self.dir / FILE_NAME

    def save(self, state: bytes) -> None:
        tmp = self.temp_path()
        with open(tmp, "wb") as f:
            f.write(state)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, self.final_path())
        dirfd = os.open(self.dir, os.O_RDONLY)
        try:
            os.fsync(dirfd)
        finally:
            os.close(dirfd)

    def load(self) -> bytes | None:
        try:
            return self.final_path().read_bytes()
        except FileNotFoundError:
            return None
