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
    # TODO(2.3): update_ref
    raise NotImplementedError("TODO(2.3): update_ref")

