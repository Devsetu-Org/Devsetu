"""PATH lookup (student-owned in chapter 2)."""

from __future__ import annotations

import os
import stat


class NotFound(Exception):
    """command not found"""


ErrNotFound = NotFound("command not found")


def look_path(name: str, directory: str, env: list[str]) -> str:
    """LookPath finds an executable for name. Absolute or relative names that
    already contain a slash are checked relative to dir. Otherwise PATH is searched.
    """
    # TODO(2.1): If name contains a path separator, resolve against dir when relative
    # and check_exec it. Otherwise split PATH from env and try each directory.
    raise NotImplementedError("TODO(2.1): look_path")


def check_exec(path: str) -> str:
    try:
        st = os.stat(path)
    except OSError as e:
        raise e
    if stat.S_ISDIR(st.st_mode):
        raise ErrNotFound
    if (st.st_mode & 0o111) == 0:
        raise ErrNotFound
    return path


def env_get(env: list[str], key: str) -> str:
    prefix = key + "="
    for i in range(len(env) - 1, -1, -1):
        if env[i].startswith(prefix):
            return env[i][len(prefix) :]
    return ""
