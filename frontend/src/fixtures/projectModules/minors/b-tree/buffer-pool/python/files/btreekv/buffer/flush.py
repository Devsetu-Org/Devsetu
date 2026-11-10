"""Flush after the log — student task 4.3."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .pool import Frame, Pool


def flush_frame(self: Pool, f: Frame) -> None:
    # TODO(4.3): If not dirty, return. If log and f.lsn > log.durable(), sync log.
    # Write page, clear dirty.
    raise NotImplementedError("TODO(4.3): flush_frame")
