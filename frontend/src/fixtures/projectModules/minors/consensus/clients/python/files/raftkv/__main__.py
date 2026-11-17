"""REPL over a 5-server replicated key/value store."""

from __future__ import annotations

from raftkv import kv

HELP = """commands:
  put <key> <value>    get <key>    del <key>
  leader               which server leads right now
  cut <n>              disconnect server n (clients too)    heal   reconnect everyone
  crash <n>            kill server n        restart <n>   boot it again
  quit"""


def main() -> None:
    c = kv.StartCluster(5)
    ck = c.NewClerk()
    print("raftkv: 5 servers running. Type help.")
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
            if len(f) > 1 and f[1].lstrip("-").isdigit():
                n = int(f[1])
                if 0 <= n < c.N():
                    node = n
            cmd = f[0]
            if cmd == "help":
                print(HELP)
            elif cmd == "put":
                if len(f) < 3:
                    print("usage: put <key> <value>")
                    continue
                ck.put(f[1].encode(), " ".join(f[2:]).encode())
            elif cmd == "get":
                if len(f) < 2:
                    print("usage: get <key>")
                    continue
                v, ok = ck.get(f[1].encode())
                print(v.decode() if ok else "(missing)")
            elif cmd == "del":
                if len(f) < 2:
                    print("usage: del <key>")
                    continue
                ck.delete(f[1].encode())
            elif cmd == "leader":
                leader, ok = c.Leader()
                print(leader if ok else "none")
            elif cmd == "cut" and node >= 0:
                c.Disconnect(node)
            elif cmd == "heal":
                c.Heal()
            elif cmd == "crash" and node >= 0:
                c.Crash(node)
            elif cmd == "restart" and node >= 0:
                c.Restart(node)
            elif cmd in ("quit", "exit"):
                break
            else:
                print("unknown command; try help")
    finally:
        c.Shutdown()


if __name__ == "__main__":
    main()
