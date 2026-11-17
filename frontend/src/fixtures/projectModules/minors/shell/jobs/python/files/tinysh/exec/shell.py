"""Shell session state."""

from __future__ import annotations

import os
import sys
import threading
from dataclasses import dataclass, field
from typing import IO, Optional, TextIO


@dataclass
class Job:
    done: threading.Event = field(default_factory=threading.Event)
    status: int = 0


class Shell:
    def __init__(
        self,
        stdin: Optional[TextIO] = None,
        stdout: Optional[TextIO] = None,
        stderr: Optional[TextIO] = None,
        dir: Optional[str] = None,
        env: Optional[list[str]] = None,
    ):
        self.stdin = stdin if stdin is not None else sys.stdin
        self.stdout = stdout if stdout is not None else sys.stdout
        self.stderr = stderr if stderr is not None else sys.stderr
        self.dir = dir if dir is not None else _must_getwd()
        self.env = env if env is not None else [f"{k}={v}" for k, v in os.environ.items()]
        self._mu = threading.Lock()
        self.jobs: list[Job] = []
        self._exited = False
        self._status = 0

    def exited(self) -> bool:
        with self._mu:
            return self._exited

    def last_status(self) -> int:
        with self._mu:
            return self._status

    def set_exit(self, code: int) -> None:
        with self._mu:
            self._exited = True
            self._status = code

    def printf_err(self, fmt: str, *args) -> None:
        self.stderr.write(fmt % args if args else fmt)
        try:
            self.stderr.flush()
        except Exception:
            pass


def _must_getwd() -> str:
    try:
        return os.getcwd()
    except OSError:
        return "."


def New() -> Shell:
    return Shell()
