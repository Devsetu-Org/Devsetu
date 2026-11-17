"""Wait for a foreground pipeline (student-owned in chapter 4)."""

from __future__ import annotations

from .spawn import wait_cmd


def wait_foreground(s, procs) -> int:
    """wait_foreground waits for every process and returns the last status."""
    status = 0
    for i, p in enumerate(procs):
        st = wait_cmd(p.cmd, p.files)
        if i == len(procs) - 1:
            status = st
    return status
