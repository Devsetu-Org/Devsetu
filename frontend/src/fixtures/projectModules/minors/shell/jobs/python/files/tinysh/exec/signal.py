"""Foreground interrupt hook (student-owned in chapter 5)."""

from __future__ import annotations

import signal as sig
import threading


def with_foreground_interrupt(s, procs, run):
    """with_foreground_interrupt runs fn while forwarding SIGINT to children."""
    _ = procs
    _ = sig.SIGINT
    _ = threading
    # TODO(5.3)
    return run()
