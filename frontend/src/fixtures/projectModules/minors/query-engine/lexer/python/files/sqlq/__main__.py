"""Print tokens from stdin."""

from __future__ import annotations

import sys

from sqlq.lex import Scan
from sqlq.lex.token import EOF, Ident, Int, String


def main() -> None:
    src = sys.stdin.read()
    try:
        toks = Scan(src)
    except Exception as e:
        print(e, file=sys.stderr)
        sys.exit(1)
    for t in toks:
        if t.kind == EOF:
            break
        if t.lit and t.kind not in (Ident, Int, String):
            print(t.kind)
            continue
        if t.lit:
            print(f"{t.kind} {t.lit}")
            continue
        print(t.kind)


if __name__ == "__main__":
    main()
