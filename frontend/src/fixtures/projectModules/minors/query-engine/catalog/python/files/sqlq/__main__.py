"""REPL entry: one statement at a time, end with ;"""

from __future__ import annotations

import sys

from sqlq import Format, Open


def main() -> None:
    db = Open()
    print("sqlq. End a statement with ;", file=sys.stderr)
    buf: list[str] = []
    while True:
        try:
            line = input("sqlq> ")
        except EOFError:
            return
        buf.append(line)
        if ";" not in line:
            continue
        stmt = "\n".join(buf)
        buf.clear()
        upper = stmt.strip().upper()
        if upper.startswith("SELECT"):
            try:
                res = db.Query(stmt)
            except Exception as e:
                print(e, file=sys.stderr)
                continue
            print(Format(res))
            continue
        try:
            db.Exec(stmt)
        except Exception as e:
            print(e, file=sys.stderr)


if __name__ == "__main__":
    main()
