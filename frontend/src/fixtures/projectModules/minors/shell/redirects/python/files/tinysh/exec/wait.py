"""Wait stub."""

from __future__ import annotations

from .spawn import wait_cmd


def wait_foreground(s, procs) -> int:
    status = 0
    for i, p in enumerate(procs):
        st = wait_cmd(p.cmd, p.files)
        if i == len(procs) - 1:
            status = st
    return status
