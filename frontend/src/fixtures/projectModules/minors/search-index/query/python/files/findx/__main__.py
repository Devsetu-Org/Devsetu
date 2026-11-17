"""REPL: add / flush."""

from __future__ import annotations

import os
import sys

from findx.findx import open_index_dir


def main() -> None:
    d = os.environ.get("FINDX_DIR", os.path.join(".", "findx-data"))
    idx = open_index_dir(d)
    print(f"findx. dir={d}  commands: add <id> <text> | flush", file=sys.stderr)
    while True:
        try:
            sys.stderr.write("findx> ")
            sys.stderr.flush()
            line = sys.stdin.readline()
        except KeyboardInterrupt:
            print(file=sys.stderr)
            return
        if not line:
            return
        line = line.strip()
        if not line:
            continue
        parts = line.split(" ", 1)
        cmd = parts[0]
        if cmd == "add":
            if len(parts) < 2:
                print("usage: add <id> <text>", file=sys.stderr)
                continue
            rest = parts[1].split(" ", 1)
            if len(rest) < 2:
                print("usage: add <id> <text>", file=sys.stderr)
                continue
            try:
                idx.add(rest[0], rest[1])
            except Exception as e:
                print(e, file=sys.stderr)
        elif cmd == "flush":
            try:
                idx.flush()
            except Exception as e:
                print(e, file=sys.stderr)
        else:
            print("unknown command", file=sys.stderr)


if __name__ == "__main__":
    main()
