"""Filter.Next — chapter 4 student work."""

from __future__ import annotations

from sqlq.execute.row import Row


def filter_next(f):
    while True:
        row, ok, err = f.child.Next()
        if err is not None or not ok:
            return Row(), ok, err
        try:
            keep = f.pred(row)
        except Exception as e:
            return Row(), False, e
        if isinstance(keep, tuple):
            keep, err = keep
            if err is not None:
                return Row(), False, err
        if keep:
            return row, True, None
