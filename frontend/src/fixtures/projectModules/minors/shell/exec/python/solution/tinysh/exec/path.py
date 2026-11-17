"""PATH lookup (student-owned in chapter 2)."""

from __future__ import annotations

import os
import stat


class NotFound(Exception):
    """command not found"""


ErrNotFound = NotFound("command not found")


def look_path(name: str, directory: str, env: list[str]) -> str:
    """LookPath finds an executable for name."""
    if name == "":
        raise ErrNotFound
    if os.sep in name or (os.altsep and os.altsep in name):
        path = name
        if not os.path.isabs(path):
            path = os.path.join(directory, path)
        return check_exec(path)
    path_env = env_get(env, "PATH")
    for d in path_env.split(os.pathsep):
        if d == "":
            d = "."
        cand = os.path.join(d, name)
        try:
            return check_exec(cand)
        except Exception:
            continue
    raise ErrNotFound


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
