"""Background jobs (student-owned in chapter 5)."""

from __future__ import annotations

import threading

from .shell import Job
from .spawn import wait_cmd


def add_job(s, procs) -> None:
    """add_job records a background pipeline."""
    # TODO(5.1): Create a Job, append under s._mu, wait in a thread, set done.
    raise NotImplementedError("TODO(5.1): add_job")


def builtin_wait(s, args: list[str]) -> int:
    # TODO(5.2): Reject args. Drain s.jobs, wait for each done event, return last status.
    raise NotImplementedError("TODO(5.2): builtin_wait")
