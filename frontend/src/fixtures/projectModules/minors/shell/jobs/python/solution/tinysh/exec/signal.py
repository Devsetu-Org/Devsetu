"""Foreground interrupt hook (student-owned in chapter 5)."""

from __future__ import annotations

import os
import signal as sig
import threading


def with_foreground_interrupt(s, procs, run):
    """with_foreground_interrupt runs fn while forwarding SIGINT to children."""
    done = {"status": None}
    finished = threading.Event()

    def runner():
        done["status"] = run()
        finished.set()

    t = threading.Thread(target=runner, daemon=True)
    prev = sig.signal(sig.SIGINT, sig.SIG_IGN)

    def handler(signum, frame):
        for p in procs:
            if p.cmd is not None and p.cmd.poll() is None:
                try:
                    p.cmd.send_signal(sig.SIGINT)
                except Exception:
                    pass

    # Install handler on main thread; poll for finish.
    sig.signal(sig.SIGINT, handler)
    t.start()
    while not finished.wait(timeout=0.05):
        pass
    sig.signal(sig.SIGINT, prev)
    return done["status"]
