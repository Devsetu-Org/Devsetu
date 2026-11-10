"""Pipeline runner and wire_pipes (student-owned in chapter 4)."""

from __future__ import annotations

import os

from tinysh.ast.ast import Pipeline

from .builtin import is_builtin
from .builtin_redir import run_builtin_with_redirs
from . import jobs, signal, wait as wait_mod
from .proc import Proc
from .run import Stdio
from .spawn import close_all, share_writer, start_cmd


def run_pipeline(s, pl: Pipeline) -> int:
    if not pl.cmds:
        return 0
    if (
        len(pl.cmds) == 1
        and not pl.background
        and pl.cmds[0].argv
        and is_builtin(pl.cmds[0].argv[0])
    ):
        return run_builtin_with_redirs(s, pl.cmds[0])
    procs, err_status = wire_pipes(s, pl)
    if procs is None:
        return err_status
    if pl.background:
        jobs.add_job(s, procs)
        return 0
    return signal.with_foreground_interrupt(s, procs, lambda: wait_mod.wait_foreground(s, procs))


def wire_pipes(s, pl: Pipeline):
    """wire_pipes starts every command with os.pipe between neighbours."""
    n = len(pl.cmds)
    if n == 1:
        cmd = pl.cmds[0]
        if not cmd.argv:
            s.printf_err("missing command\n")
            return None, 1
        try:
            c, files = start_cmd(
                s,
                cmd,
                Stdio(
                    stdin=s.stdin,
                    stdout=share_writer(s.stdout),
                    stderr=share_writer(s.stderr),
                ),
            )
        except Exception as e:
            s.printf_err("%s: %s\n", cmd.argv[0], e)
            return None, 127
        return [Proc(cmd=c, files=files)], -1
    # TODO(4.2): For n > 1, create os.pipe between neighbours, start_cmd each stage,
    # close unused pipe ends in the parent, and return the procs.
    _ = os.pipe
    raise NotImplementedError("TODO(4.2): wire_pipes")


def cleanup_pipes(pipes) -> None:
    for p in pipes:
        for end in p:
            if end is not None:
                try:
                    end.close()
                except Exception:
                    pass
