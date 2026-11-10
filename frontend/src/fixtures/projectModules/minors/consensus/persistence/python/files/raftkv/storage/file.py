"""File-backed Store. TODO 4.3, 4.4."""

from __future__ import annotations

import os
from pathlib import Path

FILE_NAME = "raft-state"


class File:
    """A Store backed by one file in a directory."""

    def __init__(self, dir: str | Path) -> None:
        self.dir = Path(dir)
        self.dir.mkdir(parents=True, exist_ok=True)

    def temp_path(self) -> Path:
        return self.dir / f"{FILE_NAME}.tmp"

    def final_path(self) -> Path:
        return self.dir / FILE_NAME

    def save(self, state: bytes) -> None:
        # ── TODO(4.3) — an atomic, durable replace ─────────────────────────────
        #
        #  1. Write state to self.temp_path(), then flush and fsync the file.
        #  2. os.replace the temp file over self.final_path(). Replace is atomic.
        #  3. Open the directory and fsync it (os.fsync on the dir fd), so the
        #     rename itself survives a power cut.
        raise NotImplementedError(
            "TODO(4.3): save — temp file, fsync, rename, fsync the directory"
        )

    def load(self) -> bytes | None:
        # ── TODO(4.4) — read what was renamed, nothing else ────────────────────
        #
        # Read self.final_path(). A missing file means "never saved": return None.
        # Never read the temp file.
        raise NotImplementedError(
            "TODO(4.4): load — read the final file, missing means empty"
        )
