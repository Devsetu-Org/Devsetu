"""REPL over a 3-node Raft cluster."""

from __future__ import annotations

import sys
import unittest

from raftkv import labharness


class _Reporter(unittest.TestCase):
    def fail(self, msg=None):  # noqa: A003
        print(f"!! {msg}", file=sys.stderr)
        raise SystemExit(1)


HELP = """commands:
  status            one line per node: role, term, vote, log, commit
  start <text>      offer a command to whichever node leads
  log <n>           print node n's log
  cut <n>           disconnect node n          heal   reconnect everyone
  crash <n>         kill node n                restart <n>   boot it again
  quit"""


def main() -> None:
    c = labharness.Cluster(_Reporter(), 3)
    print("raftkv: 3 nodes running. Type help.")
    try:
        while True:
            try:
                line = input("> ")
            except EOFError:
                break
            f = line.split()
            if not f:
                continue
            node = -1
            if len(f) > 1 and f[1].isdigit():
                n = int(f[1])
                if 0 <= n < c.N():
                    node = n
            cmd = f[0]
            if cmd == "help":
                print(HELP)
            elif cmd == "status":
                for i in range(c.N()):
                    if not c.Up(i):
                        print(f"node {i}  down")
                        continue
                    st = c.State(i)
                    print(
                        f"node {i}  {st.role:<9} term {st.term:<3} votedFor {st.voted_for:<2} "
                        f"log {len(st.log):<3} commit {st.commit_index:<3} applied {st.last_applied}"
                    )
            elif cmd == "start":
                text = line[len("start") :].strip()
                accepted = False
                for i in range(c.N()):
                    if not c.Up(i):
                        continue
                    idx, _, ok = c.Raft(i).start(text.encode())
                    if ok:
                        print(f"node {i} accepted {text!r} at index {idx}")
                        accepted = True
                        break
                if not accepted:
                    print("no node accepted it (no leader yet?)")
            elif cmd == "log":
                if node < 0:
                    print("usage: log <node>")
                    continue
                for k, e in enumerate(c.State(node).log):
                    print(f"  {k + 1}  term {e.term}  {e.command.decode()}")
            elif cmd == "cut" and node >= 0:
                c.Disconnect(node)
            elif cmd == "heal":
                c.Heal()
            elif cmd == "crash" and node >= 0:
                c.Crash(node)
            elif cmd == "restart" and node >= 0 and not c.Up(node):
                c.Restart(node)
            elif cmd in ("quit", "exit"):
                break
            else:
                print("unknown command; try help")
    finally:
        c.shutdown()


if __name__ == "__main__":
    main()
