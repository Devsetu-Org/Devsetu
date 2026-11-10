"""Wait for a foreground pipeline (student-owned in chapter 4)."""

from __future__ import annotations

from .spawn import wait_cmd


def wait_foreground(s, procs) -> int:
    """wait_foreground waits for every process and returns the last status."""
    # TODO(4.3): wait_cmd each proc; return the last status.
    raise NotImplementedError("TODO(4.3): wait_foreground")
