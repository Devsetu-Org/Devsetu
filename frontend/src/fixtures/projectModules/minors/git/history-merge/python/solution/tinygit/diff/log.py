"""log walk."""
from __future__ import annotations

from tinygit.object.commit import Commit, get_commit
from tinygit.object.hash import Hash
from tinygit.object.store import Store


def log_walk(s: Store, tip: Hash) -> tuple[list[Commit], list[Hash]]:
    """Walk first-parent history from tip, newest first."""
    commits: list[Commit] = []
    hashes: list[Hash] = []
    seen: set[Hash] = set()
    cur = tip
    while not cur.is_zero():
        if cur in seen:
            break
        seen.add(cur)
        c = get_commit(s, cur)
        commits.append(c)
        hashes.append(cur)
        if not c.parents:
            break
        cur = c.parents[0]
    return commits, hashes
