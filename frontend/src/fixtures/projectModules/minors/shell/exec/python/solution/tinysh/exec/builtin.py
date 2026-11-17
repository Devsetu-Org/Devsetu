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
    if len(args) == 0:
        directory = env_get(s.env, "HOME")
        if directory == "":
            s.printf_err("cd: HOME not set\n")
            return 1
    elif len(args) == 1:
        directory = args[0]
    else:
        s.printf_err("cd: too many arguments\n")
        return 1
    if not os.path.isabs(directory):
        directory = os.path.join(s.dir, directory)
    if not os.path.isdir(directory):
        name = args[0] if len(args) == 1 else directory
        s.printf_err("cd: %s: no such directory\n", name)
        return 1
    s.dir = directory
    return 0


def builtin_exit(s, args: list[str]) -> int:
    code = 0
    if len(args) > 0:
        try:
            code = int(args[0])
        except ValueError:
            s.printf_err("exit: numeric argument required\n")
            s.set_exit(2)
            return 2
    s.set_exit(code)
    return code
