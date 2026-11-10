"""merge-base."""
from __future__ import annotations

from collections import deque

from tinygit.object.commit import get_commit
from tinygit.object.hash import ZERO, Hash
from tinygit.object.store import Store


def merge_base(s: Store, a: Hash, b: Hash) -> Hash:
    """Return a common ancestor of a and b (BFS from a, mark; walk b)."""
    ancestors: set[Hash] = set()
    queue: deque[Hash] = deque([a])
    while queue:
        cur = queue.popleft()
        if cur in ancestors or cur.is_zero():
            continue
        ancestors.add(cur)
        c = get_commit(s, cur)
        queue.extend(c.parents)

    queue = deque([b])
    seen: set[Hash] = set()
    while queue:
        cur = queue.popleft()
        if cur in seen or cur.is_zero():
            continue
        seen.add(cur)
        if cur in ancestors:
            return cur
        c = get_commit(s, cur)
        queue.extend(c.parents)
    return ZERO
