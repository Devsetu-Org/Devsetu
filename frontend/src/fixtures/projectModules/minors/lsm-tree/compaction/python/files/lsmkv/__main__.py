"""REPL over a data directory with WAL + SSTables."""

from __future__ import annotations

import argparse
import sys

from lsmkv.db import open_db

HELP = """commands:
  put <key> <value>   store a value
  get <key>           look a key up
  del <key>           delete a key
  flush               write the memtable to a new SSTable now
  stats               memtable, log, and table counts
  quit"""


def main(argv=None) -> None:
    p = argparse.ArgumentParser(prog="lsmkv")
    p.add_argument("--dir", default="data")
    args = p.parse_args(argv)
    d = open_db(args.dir)
    try:
        s = d.stats()
        print(
            f"lsmkv: memtable, log, and SSTables (chapter 3). dir={args.dir}, "
            f"{s.tables} tables, recovered {s.memtable_entries} log entries. Type 'help'."
        )
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
            if cmd == "put" and len(rest) >= 2:
                d.put(rest[0].encode(), " ".join(rest[1:]).encode())
                print("OK")
            elif cmd == "get" and len(rest) == 1:
                value, ok = d.get(rest[0].encode())
                print(repr(value.decode()) if ok else "(not found)")
            elif cmd == "del" and len(rest) == 1:
                d.delete(rest[0].encode())
                print("OK")
            elif cmd == "flush":
                d.Flush()
                print("OK")
            elif cmd == "stats":
                s = d.stats()
                print(
                    f"memtable entries={s.memtable_entries} bytes={s.memtable_bytes}  "
                    f"wal bytes={s.wal_bytes}  tables={s.tables}"
                )
            elif cmd in ("quit", "exit"):
                return
            else:
                print(HELP)
    finally:
        d.close()


if __name__ == "__main__":
    main(sys.argv[1:])
