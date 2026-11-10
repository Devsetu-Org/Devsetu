"""WAL writer — student task 3.2 (Append)."""

from __future__ import annotations

import os
from enum import IntEnum
from typing import List

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
        """Write recs to the end of the log as one batch."""
        # TODO(3.2): Clear self._buf, encode each record into it, write the
        # whole buffer once with os.write(self._fd, ...), add the bytes written
        # to self._size. Under SyncMode.ALWAYS, call self.sync().
        raise NotImplementedError("TODO(3.2): append")

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
