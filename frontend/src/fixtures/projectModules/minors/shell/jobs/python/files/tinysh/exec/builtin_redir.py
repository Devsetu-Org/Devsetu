"""Run builtins with temporary stdio redirects."""

from __future__ import annotations

from tinysh.ast.ast import Cmd

from . import open as open_mod
from .apply import apply_redirs_io
from .builtin import run_builtin
from .run import Stdio
from .spawn import close_all


def run_builtin_with_redirs(s, cmd: Cmd) -> int:
    if not cmd.redirs:
        st, _ = run_builtin(s, cmd.argv)
        return st
    files = open_mod.open_redirs(s.dir, cmd.redirs)
    try:
        old_in, old_out, old_err = s.stdin, s.stdout, s.stderr
        io = apply_redirs_io(Stdio(s.stdin, s.stdout, s.stderr), cmd.redirs, files)
        s.stdin, s.stdout, s.stderr = io.stdin, io.stdout, io.stderr
        st, _ = run_builtin(s, cmd.argv)
        s.stdin, s.stdout, s.stderr = old_in, old_out, old_err
        return st
    finally:
        close_all(files)
