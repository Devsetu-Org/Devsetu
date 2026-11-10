"""REPL over the engine (chapter 2+)."""

from __future__ import annotations

import argparse
import sys

from btreekv.db import DB, ErrNotYet

HELP = """commands:
  put <key> <value>        store a value
  get <key>                look a key up
  del <key>                delete a key
  scan [start [end]]       list keys in [start, end)
  stats                    shape of the tree and the file
  quit"""


def main() -> None:
    ap = argparse.ArgumentParser(prog="btreekv")
    ap.add_argument("--dir", default="data", help="data directory")
    args = ap.parse_args()
    try:
        d = DB.open(args.dir)
    except Exception as e:
        print("open:", e, file=sys.stderr)
        sys.exit(1)
    try:
        s = d.stats()
        print(f"btreekv: dir={args.dir}, {s.keys} keys, height {s.height}. Type 'help'.")
        while True:
            try:
                line = input("> ")
            except EOFError:
                print()
                return
            fields = line.split()
            if not fields:
                continue
            cmd, rest = fields[0].lower(), fields[1:]
            try:
                if cmd == "put" and len(rest) >= 2:
                    d.put(rest[0].encode(), " ".join(rest[1:]).encode())
                    print("OK")
                elif cmd == "get" and len(rest) == 1:
                    value, ok = d.get(rest[0].encode())
                    if ok:
                        print(repr(value.decode(errors="replace")))
                    else:
                        print("(not found)")
                elif cmd == "del" and len(rest) == 1:
                    d.delete(rest[0].encode())
                    print("OK")
                elif cmd == "scan" and len(rest) <= 2:
                    start = rest[0].encode() if rest else b""
                    end = rest[1].encode() if len(rest) > 1 else b""
                    def fn(k: bytes, v: bytes) -> bool:
                        print(f"{k.decode(errors='replace')}  {v!r}")
                        return True
                    d.scan(start, end, fn)
                elif cmd == "stats":
                    s = d.stats()
                    print(
                        f"keys={s.keys} height={s.height} leaves={s.leaves} "
                        f"internal={s.internal} pages={s.pages} free={s.free_pages}"
                    )
                elif cmd in ("quit", "exit"):
                    return
                else:
                    print(HELP)
            except ErrNotYet as e:
                print("error:", e)
            except Exception as e:
                print("error:", e)
    finally:
        d.close()


if __name__ == "__main__":
    main()
