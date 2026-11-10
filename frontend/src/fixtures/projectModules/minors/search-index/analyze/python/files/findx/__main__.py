"""Print analyzed tokens from stdin."""

from __future__ import annotations

import sys

from findx.analyze import analyze


def main() -> None:
    for line in sys.stdin:
        print(" ".join(analyze(line.rstrip("\n"))))


if __name__ == "__main__":
    main()
