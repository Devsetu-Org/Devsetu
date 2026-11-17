"""tinygit CLI."""
from __future__ import annotations

import sys

from tinygit import repo as repo_mod
from tinygit.object.blob import TYPE_BLOB, put_blob
from tinygit.object.hash import ZERO, parse_hex
from tinygit.ref.update import update_ref
from tinygit.index.add import add
from tinygit.index.status import status

def usage() -> None:
    print("tinygit <command>\n  init | hash-object | cat-file | update-ref | add | status", file=sys.stderr)


def main(argv: list[str] | None = None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    if not argv:
        usage()
        return 2
    try:
        run(argv[0], argv[1:])
    except Exception as e:
        print(e, file=sys.stderr)
        return 1
    return 0


def run(cmd: str, args: list[str]) -> None:
    if cmd == "init":
        root = args[0] if args else "."
        r = repo_mod.init(root)
        print("initialized", r.git_dir())
        return
    if cmd == "hash-object":
        if not args:
            raise ValueError("hash-object <file>")
        r = repo_mod.open_repo(".")
        with open(args[0], "rb") as f:
            data = f.read()
        print(put_blob(r.objects(), data).hex())
        return
    if cmd == "cat-file":
        if len(args) < 2:
            raise ValueError("cat-file -t|-p <hash>")
        r = repo_mod.open_repo(".")
        h = parse_hex(args[1])
        typ, content = r.objects().get(h)
        if args[0] == "-t":
            print(typ)
            return
        sys.stdout.buffer.write(content)
        if typ != TYPE_BLOB and not content.endswith(b"\n"):
            print()
        return
    if cmd == "update-ref":
        if len(args) < 2:
            raise ValueError("update-ref <name> <hash>")
        r = repo_mod.open_repo(".")
        update_ref(r, args[0], parse_hex(args[1]), ZERO)
        return
    if cmd == "add":
        if not args:
            raise ValueError("add <path>")
        add(repo_mod.open_repo("."), args[0])
        return
    if cmd == "status":
        st = status(repo_mod.open_repo("."))
        for title, paths in (("Staged", st.staged), ("Modified", st.modified), ("Untracked", st.untracked)):
            if paths:
                print(title + ":")
                for p in paths:
                    print("  ", p)
        return

    usage()
    raise ValueError(f"unknown command {cmd!r}")


if __name__ == "__main__":
    raise SystemExit(main())
