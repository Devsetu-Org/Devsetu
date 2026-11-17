"""Start a command with redirects applied."""

from __future__ import annotations

import io
import threading
from typing import Any

from tinysh.ast.ast import Cmd

from . import open as open_mod
from .apply import apply_redirs_io
from .run import Stdio, start_process, wait_process


class LockedWriter:
    def __init__(self, w):
        self._mu = threading.Lock()
        self._w = w

    def write(self, data):
        with self._mu:
            return self._w.write(data)

    def flush(self):
        with self._mu:
            return self._w.flush()

    def fileno(self):
        return self._w.fileno()


def share_writer(w):
    if w is None:
        return None
    if isinstance(w, LockedWriter):
        return w
    # File objects from open() are fine; BytesIO/StringIO need locking across pipes.
    if hasattr(w, "fileno"):
        try:
            w.fileno()
            return w
        except Exception:
            pass
    return LockedWriter(w)


def start_cmd(s, cmd: Cmd, base: Stdio):
    files = open_mod.open_redirs(s.dir, cmd.redirs)
    io = apply_redirs_io(base, cmd.redirs, files)
    try:
        c = start_process(s, cmd.argv, io)
    except Exception:
        close_all(files)
        raise
    return c, files


def close_all(files) -> None:
    for f in files:
        try:
            f.close()
        except Exception:
            pass


def wait_cmd(c, files) -> int:
    st = wait_process(c)
    close_all(files)
    return st
