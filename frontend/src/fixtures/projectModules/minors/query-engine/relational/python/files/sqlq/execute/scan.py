"""Scan.Next — chapter 4 student work."""

from __future__ import annotations

from sqlq.execute.row import Row


def scan_next(s):
    if s.i >= len(s.rows):
        return Row(), False, None
    vals = list(s.rows[s.i])
    s.i += 1
    return Row(cols=list(s.cols), vals=vals), True, None
