"""Jobs stubs until the jobs chapter."""

from __future__ import annotations

from .spawn import wait_cmd


def add_job(s, procs) -> None:
    s.printf_err("background jobs not supported yet\n")
    for p in procs:
        try:
            p.cmd.kill()
        except Exception:
            pass
        wait_cmd(p.cmd, p.files)


def builtin_wait(s, args: list[str]) -> int:
    s.printf_err("wait: not supported yet\n")
    return 1
