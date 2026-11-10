"""Project.Next — chapter 4 student work."""

from __future__ import annotations

from sqlq.execute.row import Row


def project_next(p):
    row, ok, err = p.child.Next()
    if err is not None or not ok:
        return Row(), ok, err
    try:
        out = p.pick(row)
    except Exception as e:
        return Row(), False, e
    return out, True, None
