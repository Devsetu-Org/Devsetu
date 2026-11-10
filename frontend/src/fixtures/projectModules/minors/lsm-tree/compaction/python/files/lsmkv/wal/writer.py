"""Append records to one log file."""

from __future__ import annotations

import os
from enum import IntEnum
from typing import BinaryIO

from .record import Record, encode


class SyncMode(IntEnum):
    """When an append is pushed from the OS page cache to disk."""

    # fsync after every append. An acknowledged write survives a power cut.
    # This is the default.
    ALWAYS = 0
    # Leave flushing to the OS. A process crash loses nothing (the page cache
    # survives it), but a power cut can lose the last few seconds.
    NEVER = 1


class Writer:
    """Appends records to one log file."""

    def __init__(self, f: BinaryIO, mode: SyncMode, size: int = 0) -> None:
        self._f = f
        self._mode = mode
        self._buf = bytearray()
        self._size = size

    def append(self, r: Record) -> None:
        """Write r to the end of the log.

        When it returns under SyncMode.ALWAYS, the record is on disk.
        """
        del self._buf[:]
        encode(self._buf, r)
        n = self._f.write(self._buf)
        self._size += n
        if self._mode is SyncMode.ALWAYS:
            self._f.flush()
            os.fsync(self._f.fileno())

    def size(self) -> int:
        """Number of bytes in the log."""
        return self._size

    def close(self) -> None:
        """Sync and close the file."""
        self._f.flush()
        os.fsync(self._f.fileno())
        self._f.close()


def create(path: str, mode: SyncMode) -> Writer:
    """Make an empty log at path, replacing any file already there."""
    f = open(path, "wb", buffering=0)
    return Writer(f, mode)


def open_append(path: str, good: int, mode: SyncMode) -> Writer:
    """Open the log at path for appending after its first good bytes,
    cutting off anything beyond them (a torn tail found by replay). The file
    is created if it does not exist.
    """
    if not os.path.exists(path):
        open(path, "wb").close()
    f = open(path, "r+b", buffering=0)
    f.truncate(good)
    f.seek(good)
    os.fsync(f.fileno())
    return Writer(f, mode, size=good)
