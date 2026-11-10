"""Start and wait for external processes (student-owned in chapter 2)."""

from __future__ import annotations

import os
import subprocess
import threading
from typing import Any, Optional

from .path import look_path


class Stdio:
    def __init__(self, stdin=None, stdout=None, stderr=None):
        self.stdin = stdin
        self.stdout = stdout
        self.stderr = stderr


def _has_fileno(stream) -> bool:
    if stream is None:
        return False
    try:
        stream.fileno()
        return True
    except Exception:
        return False


def _pump_out(src, dest) -> None:
    try:
        while True:
            chunk = src.read(4096)
            if not chunk:
                break
            if isinstance(chunk, bytes):
                # dest may be text
                try:
                    dest.write(chunk.decode())
                except Exception:
                    dest.write(chunk)
            else:
                dest.write(chunk)
            try:
                dest.flush()
            except Exception:
                pass
    finally:
        try:
            src.close()
        except Exception:
            pass


def _pump_in(src, dest) -> None:
    try:
        data = src.read()
        if data:
            if isinstance(data, str):
                dest.write(data.encode())
            else:
                dest.write(data)
        dest.close()
    except Exception:
        try:
            dest.close()
        except Exception:
            pass


def start_process(s, argv: list[str], io: Stdio) -> subprocess.Popen:
    """start_process looks up argv[0] and starts the process with the given stdio.
    It does not wait. The caller waits with wait_process.
    """
    path = look_path(argv[0], s.dir, s.env)
    env_dict = {}
    for item in s.env:
        if "=" in item:
            k, v = item.split("=", 1)
            env_dict[k] = v

    stdin_arg: Any = io.stdin
    stdout_arg: Any = io.stdout
    stderr_arg: Any = io.stderr
    pumps = []

    if io.stdin is not None and not _has_fileno(io.stdin):
        stdin_arg = subprocess.PIPE
    if io.stdout is not None and not _has_fileno(io.stdout):
        stdout_arg = subprocess.PIPE
    if io.stderr is not None and not _has_fileno(io.stderr):
        stderr_arg = subprocess.PIPE

    # Avoid closing pass_fds incorrectly; only pass real fds above 2.
    pass_fds = []
    for stream, arg in (
        (io.stdin, stdin_arg),
        (io.stdout, stdout_arg),
        (io.stderr, stderr_arg),
    ):
        if arg is not subprocess.PIPE and _has_fileno(stream):
            fd = stream.fileno()
            if fd > 2:
                pass_fds.append(fd)

    c = subprocess.Popen(
        [path, *argv[1:]],
        cwd=s.dir,
        env=env_dict,
        stdin=stdin_arg,
        stdout=stdout_arg,
        stderr=stderr_arg,
        pass_fds=tuple(sorted(set(pass_fds))) if pass_fds else (),
    )
    c._tinysh_pumps = pumps  # type: ignore[attr-defined]

    if stdin_arg is subprocess.PIPE:
        t = threading.Thread(target=_pump_in, args=(io.stdin, c.stdin), daemon=True)
        t.start()
        pumps.append(t)
    if stdout_arg is subprocess.PIPE:
        t = threading.Thread(target=_pump_out, args=(c.stdout, io.stdout), daemon=True)
        t.start()
        pumps.append(t)
    if stderr_arg is subprocess.PIPE:
        t = threading.Thread(target=_pump_out, args=(c.stderr, io.stderr), daemon=True)
        t.start()
        pumps.append(t)
    return c


def wait_process(c: subprocess.Popen) -> int:
    """wait_process waits for a process started by start_process and returns its status."""
    code = c.wait()
    for t in getattr(c, "_tinysh_pumps", []):
        t.join()
    return exit_status(code)


def exit_status(code: Optional[int]) -> int:
    if code is None:
        return 127
    if code < 0:
        return 128 + (-code)
    return code
