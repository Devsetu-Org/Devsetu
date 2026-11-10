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
    # TODO(2.2): look_path argv[0], build subprocess.Popen with cwd/env/stdio
    # (use _has_fileno / PIPE + _pump_* when streams lack fileno), Start it.
    raise NotImplementedError("TODO(2.2): start_process")


def wait_process(c: subprocess.Popen) -> int:
    """wait_process waits for a process started by start_process and returns its status."""
    # TODO(2.2): Wait and map the code via exit_status; join any _tinysh_pumps.
    raise NotImplementedError("TODO(2.2): wait_process")


def exit_status(code: Optional[int]) -> int:
    if code is None:
        return 127
    if code < 0:
        return 128 + (-code)
    return code
