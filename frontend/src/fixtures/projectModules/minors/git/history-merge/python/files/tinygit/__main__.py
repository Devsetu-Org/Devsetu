"""tinygit CLI."""
from __future__ import annotations

import os
import sys

from tinygit import repo as repo_mod
from tinygit.diff.diff import tree_diff
from tinygit.diff.log import log_walk
from tinygit.index.add import add
from tinygit.index.status import status
from tinygit.merge.merge import merge
from tinygit.object.blob import TYPE_BLOB, put_blob
from tinygit.object.hash import ZERO, parse_hex
from tinygit.ref.update import update_ref
from tinygit.worktree.checkout import checkout, checkout_branch
from tinygit.worktree.commit import CommitOpts, commit
from tinygit.worktree.write_tree import write_tree


def usage() -> None:
    print(
        "tinygit <command>\n"
        "  init | hash-object | cat-file | update-ref | add | status\n"
        "  write-tree | commit | checkout | log | diff | merge",
        file=sys.stderr,
    )


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
        h = put_blob(r.objects(), data)
        print(h.hex())
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
        h = parse_hex(args[1])
        update_ref(r, args[0], h, ZERO)
        return
    if cmd == "add":
        if not args:
            raise ValueError("add <path>")
        r = repo_mod.open_repo(".")
        add(r, args[0])
        return
    if cmd == "status":
        r = repo_mod.open_repo(".")
        st = status(r)
        _print_list("Staged", st.staged)
        _print_list("Modified", st.modified)
        _print_list("Untracked", st.untracked)
        return
    if cmd == "write-tree":
        r = repo_mod.open_repo(".")
        h = write_tree(r)
        print(h.hex())
        return
    if cmd == "commit":
        msg = ""
        for i, a in enumerate(args):
            if a == "-m" and i + 1 < len(args):
                msg = args[i + 1]
                break
        r = repo_mod.open_repo(".")
        h = commit(r, CommitOpts(message=msg))
        print(h.hex())
        return
    if cmd == "checkout":
        if not args:
            raise ValueError("checkout <branch|hash>")
        r = repo_mod.open_repo(".")
        try:
            h = parse_hex(args[0])
        except ValueError:
            checkout_branch(r, args[0])
        else:
            checkout(r, h)
        return
    if cmd == "log":
        r = repo_mod.open_repo(".")
        from tinygit.ref.head import resolve_head

        tip = resolve_head(r)
        commits, hashes = log_walk(r.objects(), tip)
        for i, c in enumerate(commits):
            print(f"commit {hashes[i].hex()}")
            print(f"Author: {c.author}\n")
            print(f"    {c.message.strip()}\n")
        return
    if cmd == "diff":
        if len(args) < 2:
            raise ValueError("diff <tree-a> <tree-b>")
        r = repo_mod.open_repo(".")
        a = parse_hex(args[0])
        b = parse_hex(args[1])
        for ch in tree_diff(r.objects(), a, b):
            print(f"{ch.status}\t{ch.path}")
        return
    if cmd == "merge":
        if not args:
            raise ValueError("merge <branch>")
        r = repo_mod.open_repo(".")
        res = merge(r, args[0])
        if res.fast_forward:
            print("fast-forward", res.commit.hex())
        else:
            print(res.commit.hex())
        return
    usage()
    raise ValueError(f"unknown command {cmd!r}")


def _print_list(title: str, paths: list[str]) -> None:
    if not paths:
        return
    print(title + ":")
    for p in paths:
        print("  ", p)


if __name__ == "__main__":
    raise SystemExit(main())
