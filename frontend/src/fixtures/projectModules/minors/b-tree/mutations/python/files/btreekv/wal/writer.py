"""WAL writer — student task 3.2 (Append)."""

from __future__ import annotations

import os
from enum import IntEnum

from .record import Record, encode


class SyncMode(IntEnum):
    ALWAYS = 0
    NEVER = 1


class Writer:
    def __init__(self, fd: int, mode: SyncMode, size: int = 0, synced: int = 0):
        self._fd = fd
        self.mode = mode
        self._buf = bytearray()
        self._size = size
        self._synced = synced

    def append(self, *recs: Record) -> None:
        self._buf = bytearray()
        for r in recs:
            encode(self._buf, r)
        n = os.write(self._fd, self._buf)
        self._size += n
        if self.mode == SyncMode.ALWAYS:
            self.sync()

    def sync(self) -> None:
        os.fsync(self._fd)
        self._synced = self._size

    def size(self) -> int:
        return self._size

    def durable(self) -> int:
        return self._synced

    def rewind(self, to: int) -> None:
        os.ftruncate(self._fd, to)
        os.lseek(self._fd, to, os.SEEK_SET)
        self._size = to
        self._synced = min(self._synced, to)

    def reset(self) -> None:
        self.rewind(0)
        self.sync()

    def close(self) -> None:
        try:
            self.sync()
        finally:
            os.close(self._fd)


def create(path: str, mode: SyncMode) -> Writer:
    fd = os.open(path, os.O_CREAT | os.O_TRUNC | os.O_WRONLY, 0o644)
    return Writer(fd, mode)


def open_append(path: str, good: int, mode: SyncMode) -> Writer:
    fd = os.open(path, os.O_CREAT | os.O_WRONLY, 0o644)
    try:
        os.ftruncate(fd, good)
        os.lseek(fd, good, os.SEEK_SET)
        os.fsync(fd)
    except Exception:
        os.close(fd)
        raise
    return Writer(fd, mode, size=good, synced=good)
