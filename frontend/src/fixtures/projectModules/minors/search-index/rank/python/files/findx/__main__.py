"""REPL: add / flush / search."""

from __future__ import annotations

import os
import sys

from findx.analyze import analyze
from findx.findx import open_index_dir


def main() -> None:
    if len(sys.argv) > 1 and sys.argv[1] == "analyze":
        for line in sys.stdin:
            print(" ".join(analyze(line.rstrip("\n"))))
        return

    d = os.environ.get("FINDX_DIR", os.path.join(".", "findx-data"))
    idx = open_index_dir(d)
    print(
        f"findx. dir={d}  commands: add <id> <text> | flush | search <k> <query>",
        file=sys.stderr,
    )
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
        elif cmd == "search":
            if len(parts) < 2:
                print("usage: search <k> <query>", file=sys.stderr)
                continue
            rest = parts[1].split(" ", 1)
            if len(rest) < 2:
                print("usage: search <k> <query>", file=sys.stderr)
                continue
            try:
                k = int(rest[0])
            except ValueError:
                print("k must be an int", file=sys.stderr)
                continue
            try:
                hits = idx.search(rest[1], k)
            except Exception as e:
                print(e, file=sys.stderr)
                continue
            for h in hits:
                print(f"{h.id}\t{h.score:.6f}")
        else:
            print("unknown command", file=sys.stderr)


if __name__ == "__main__":
    main()
