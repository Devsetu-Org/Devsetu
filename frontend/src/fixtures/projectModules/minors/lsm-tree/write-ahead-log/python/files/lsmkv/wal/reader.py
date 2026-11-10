"""Replay intact records; stop at the first torn or corrupt one."""

from __future__ import annotations

from typing import Callable

from .record import Record


def replay(path: str, fn: Callable[[Record], None]) -> int:
    """Call fn for every intact record in the log at path, oldest first.

    Stops at the first record that is cut short or fails its checksum.
    Everything from there on is a torn tail: an append the crash interrupted,
    which was never acknowledged. Returns good, the offset just past the last
    intact record, so the caller can cut the tail off before appending.

    A missing file is an empty log. The slices in a Record alias the read
    buffer, so fn must copy anything it keeps (Memtable.put already does).
    """
    try:
        with open(path, "rb") as f:
            data = f.read()
    except FileNotFoundError:
        return 0
    # TODO(2.3): walk data one record at a time from offset good. Stop and
    # return good when fewer than HEADER_SIZE bytes remain, the length is over
    # MAX_RECORD_SIZE or runs past the end, the checksum does not match, or
    # decode_payload fails. Otherwise call fn (propagate its exception) and
    # advance good past the record.
    _ = data
    raise NotImplementedError("TODO(2.3): replay")
