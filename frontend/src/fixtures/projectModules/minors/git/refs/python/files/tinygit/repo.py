"""Repository layout: .tinygit/{objects,refs,HEAD,index}."""
from __future__ import annotations

import os
from pathlib import Path

from tinygit.object.store import Store

DIR_NAME = ".tinygit"


class Repo:
    """A tinygit repository rooted at root (the worktree)."""

    def __init__(self, root: str) -> None:
        self.root = root

    def git_dir(self) -> str:
        return os.path.join(self.root, DIR_NAME)

    def objects(self) -> Store:
        return Store(os.path.join(self.git_dir(), "objects"))

    def index_path(self) -> str:
        return os.path.join(self.git_dir(), "index")


def init(root: str = ".") -> Repo:
    """Create .tinygit/{objects,refs/heads} and a symbolic HEAD to main."""
    abs_root = str(Path(root).resolve())
    git = os.path.join(abs_root, DIR_NAME)
    os.makedirs(os.path.join(git, "objects"), exist_ok=True)
    os.makedirs(os.path.join(git, "refs", "heads"), exist_ok=True)
    head = os.path.join(git, "HEAD")
    if not os.path.exists(head):
        with open(head, "w", encoding="utf-8") as f:
            f.write("ref: refs/heads/main\n")
    return Repo(abs_root)


def open_repo(path: str = ".") -> Repo:
    """Find .tinygit walking up from path."""
    abs_path = str(Path(path).resolve())
    cur = abs_path
    while True:
        git = os.path.join(cur, DIR_NAME)
        if os.path.isdir(git):
            return Repo(cur)
        parent = os.path.dirname(cur)
        if parent == cur:
            raise FileNotFoundError("repo: not a tinygit repository")
        cur = parent
