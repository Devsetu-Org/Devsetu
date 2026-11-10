"""Print tokens for one stdin blob (lexer chapter)."""
from __future__ import annotations

import sys
from tinysh.lex import Scan
from tinysh.lex.token import EOF, Word, kind_name


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
        if t.kind == Word:
            print(f"{kind_name(t.kind)} {t.lit!r}")
        else:
            print(kind_name(t.kind))


if __name__ == "__main__":
    main()
