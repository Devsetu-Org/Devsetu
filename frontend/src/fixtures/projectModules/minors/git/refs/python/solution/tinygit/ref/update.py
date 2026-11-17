"""update-ref."""
from __future__ import annotations

from tinygit.object.hash import Hash
from tinygit.ref.head import read_head, write_detached_head
from tinygit.ref.ref import read, write
from tinygit.repo import Repo


def update_ref(r: Repo, name: str, new_hash: Hash, old_hash: Hash) -> None:
    """Set name to new_hash. If old_hash is non-zero, current must match.

    When name is HEAD and HEAD is symbolic, update the branch tip instead.
    """
    target = name
    if name == "HEAD":
        hd = read_head(r)
        if hd.symbolic:
            target = hd.symbolic
        else:
            if not old_hash.is_zero():
                if hd.hash != old_hash:
                    raise ValueError(f"ref: HEAD is {hd.hash}, expected {old_hash}")
            write_detached_head(r, new_hash)
            return

    if not old_hash.is_zero():
        cur = read(r, target)
        if cur != old_hash:
            raise ValueError(f"ref: {target} is {cur}, expected {old_hash}")
    write(r, target, new_hash)
