"""Builtins cd and exit (student-owned in chapter 2)."""

from __future__ import annotations

import os

from .path import env_get


def is_builtin(name: str) -> bool:
    return name in ("cd", "exit", "wait")


def run_builtin(s, argv: list[str]):
    if not argv:
        return 0, False
    if argv[0] == "cd":
        return builtin_cd(s, argv[1:]), True
    if argv[0] == "exit":
        return builtin_exit(s, argv[1:]), True
    if argv[0] == "wait":
        from . import jobs

        return jobs.builtin_wait(s, argv[1:]), True
    return 0, False


def builtin_cd(s, args: list[str]) -> int:
    # TODO(2.3): Resolve the directory (HOME when no args), Stat it, set s.dir.
    raise NotImplementedError("TODO(2.3): builtin_cd")


def builtin_exit(s, args: list[str]) -> int:
    # TODO(2.3): Parse an optional numeric code, call s.set_exit, return the code.
    raise NotImplementedError("TODO(2.3): builtin_exit")
