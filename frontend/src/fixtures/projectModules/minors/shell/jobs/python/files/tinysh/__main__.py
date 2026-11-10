"""tinysh REPL: read lines from stdin and run them."""

from __future__ import annotations

import sys

from tinysh.exec.shell import New


def main() -> None:
    sh = New()
    while True:
        line = sys.stdin.readline()
        if line:
            status = sh.run_line(line)
            if sh.exited():
                sys.exit(sh.last_status())
            _ = status
        if not line:
            return


if __name__ == "__main__":
    main()
