"""Foreground interrupt hook (student-owned in chapter 5)."""

from __future__ import annotations

import signal as sig
import threading


def with_foreground_interrupt(s, procs, run):
    """with_foreground_interrupt runs fn while forwarding SIGINT to children."""
    # The pass-through keeps ordinary tests green. Replace the body for TODO(5.3).
    _ = procs
    _ = sig.SIGINT
    _ = threading
    # TODO(5.3): Install a SIGINT handler, run fn in a thread, forward SIGINT to children.
    return run()
