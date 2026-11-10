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
    procs = [Proc() for _ in range(n)]
    pipes: list[list] = []  # [r, w] file objects

    for i, cmd in enumerate(pl.cmds):
        if not cmd.argv:
            s.printf_err("missing command\n")
            cleanup_pipes(pipes)
            return None, 1
        if is_builtin(cmd.argv[0]) and (n > 1 or pl.background):
            s.printf_err("%s: builtin not allowed in pipeline or background\n", cmd.argv[0])
            cleanup_pipes(pipes)
            return None, 1

        base = Stdio(
            stdin=s.stdin,
            stdout=share_writer(s.stdout),
            stderr=share_writer(s.stderr),
        )
        if i > 0:
            base.stdin = pipes[i - 1][0]
        if i < n - 1:
            r_fd, w_fd = os.pipe()
            r = os.fdopen(r_fd, "rb", buffering=0)
            w = os.fdopen(w_fd, "wb", buffering=0)
            pipes.append([r, w])
            base.stdout = w

        try:
            c, files = start_cmd(s, cmd, base)
        except Exception as e:
            s.printf_err("%s: %s\n", cmd.argv[0], e)
            cleanup_pipes(pipes)
            for j in range(i):
                try:
                    procs[j].cmd.kill()
                    procs[j].cmd.wait()
                except Exception:
                    pass
                close_all(procs[j].files)
            return None, 127
        procs[i] = Proc(cmd=c, files=files)

        if i < n - 1:
            pipes[i][1].close()
            pipes[i][1] = None
        if i > 0:
            pipes[i - 1][0].close()
            pipes[i - 1][0] = None
    return procs, -1


def cleanup_pipes(pipes) -> None:
    for p in pipes:
        for end in p:
            if end is not None:
                try:
                    end.close()
                except Exception:
                    pass
