"""Background jobs (student-owned in chapter 5)."""

from __future__ import annotations

import threading

from .shell import Job
from .spawn import wait_cmd


def add_job(s, procs) -> None:
    """add_job records a background pipeline."""
    j = Job()
    with s._mu:
        s.jobs.append(j)

    def worker():
        status = 0
        for i, p in enumerate(procs):
            st = wait_cmd(p.cmd, p.files)
            if i == len(procs) - 1:
                status = st
        j.status = status
        j.done.set()

    threading.Thread(target=worker, daemon=True).start()


def builtin_wait(s, args: list[str]) -> int:
    if args:
        s.printf_err("wait: arguments not supported\n")
        return 1
    with s._mu:
        jobs = list(s.jobs)
        s.jobs = []
    status = 0
    for j in jobs:
        j.done.wait()
        status = j.status
    return status
