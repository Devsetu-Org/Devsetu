"""Print a short summary of a parsed SELECT."""

from __future__ import annotations

import sys

from sqlq.parse import Parse, Select


def main() -> None:
    src = sys.stdin.read()
    try:
        stmt = Parse(src)
    except Exception as e:
        print(e, file=sys.stderr)
        sys.exit(1)
    if isinstance(stmt, Select):
        print(f"SELECT {len(stmt.items)} cols FROM {stmt.from_table}")
    else:
        print(type(stmt).__name__)


if __name__ == "__main__":
    main()
