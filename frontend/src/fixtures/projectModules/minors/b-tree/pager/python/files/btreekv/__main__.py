"""REPL over the pager (chapter 1)."""

from __future__ import annotations

import argparse
import sys

from btreekv.pager import PAGE_SIZE, USABLE, Pager

HELP = """commands:
  alloc               allocate a page
  free <n>            free page n
  write <n> <text>    write text into page n
  read <n>            read page n back
  meta                show the header state
  quit"""


def main() -> None:
    ap = argparse.ArgumentParser(prog="btreekv")
    ap.add_argument("--file", default="data.db", help="page file")
    args = ap.parse_args()

    try:
        p = Pager.open(args.file)
    except Exception as e:
        print("open:", e, file=sys.stderr)
        sys.exit(1)

    print(f"btreekv: pager (chapter 1). file={args.file}, {p.meta().page_count} pages. Type 'help'.")
    try:
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
            if cmd == "alloc":
                try:
                    print("page", p.allocate())
                except Exception as e:
                    print("error:", e)
            elif cmd == "free" and len(rest) == 1:
                try:
                    p.free(int(rest[0]))
                    print("OK")
                except Exception as e:
                    print("error:", e)
            elif cmd == "write" and len(rest) >= 2:
                try:
                    no = int(rest[0])
                    buf = bytearray(PAGE_SIZE)
                    text = " ".join(rest[1:]).encode()
                    buf[: len(text)] = text
                    p.write_page(no, buf)
                    print("OK")
                except Exception as e:
                    print("error:", e)
            elif cmd == "read" and len(rest) == 1:
                try:
                    buf = bytearray(PAGE_SIZE)
                    p.read_page(int(rest[0]), buf)
                    text = bytes(buf[:USABLE]).rstrip(b"\x00").decode(errors="replace")
                    print(repr(text))
                except Exception as e:
                    print("error:", e)
            elif cmd == "meta":
                m = p.meta()
                print(f"root={m.root} pages={m.page_count} freelist head={m.free_head}")
            elif cmd in ("quit", "exit"):
                return
            else:
                print(HELP)
    finally:
        p.close()


if __name__ == "__main__":
    main()
