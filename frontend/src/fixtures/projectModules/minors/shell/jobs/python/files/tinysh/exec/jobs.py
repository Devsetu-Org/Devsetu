"""Background jobs (student-owned in chapter 5)."""

from __future__ import annotations

import threading

from .shell import Job
from .spawn import wait_cmd


def add_job(s, procs) -> None:
    """add_job records a background pipeline."""
    # TODO(5.1)
    raise NotImplementedError("TODO(5.1)")


def builtin_wait(s, args: list[str]) -> int:
    # TODO(5.2)
    raise NotImplementedError("TODO(5.2)")
