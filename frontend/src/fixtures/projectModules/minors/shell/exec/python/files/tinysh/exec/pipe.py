"""Pipeline runner — single foreground command until pipes chapter."""

from __future__ import annotations

from tinysh.ast.ast import Pipeline

from .builtin import is_builtin
from .builtin_redir import run_builtin_with_redirs
from .run import Stdio
from .spawn import start_cmd, wait_cmd


def run_pipeline(s, pl: Pipeline) -> int:
    if not pl.cmds:
        return 0
    if pl.background:
        s.printf_err("background jobs not supported yet\n")
        return 1
    if len(pl.cmds) != 1:
        s.printf_err("pipelines not supported yet\n")
        return 1
    cmd = pl.cmds[0]
    if not cmd.argv:
        s.printf_err("missing command\n")
        return 1
    if is_builtin(cmd.argv[0]):
        return run_builtin_with_redirs(s, cmd)
    try:
        c, files = start_cmd(s, cmd, Stdio(stdin=s.stdin, stdout=s.stdout, stderr=s.stderr))
    except Exception as e:
        s.printf_err("%s: %s\n", cmd.argv[0], e)
        return 127
    return wait_cmd(c, files)
