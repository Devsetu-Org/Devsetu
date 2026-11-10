"""log walk."""
from __future__ import annotations

from tinygit.object.commit import Commit, get_commit
from tinygit.object.hash import Hash
from tinygit.object.store import Store


def log_walk(s: Store, tip: Hash) -> tuple[list[Commit], list[Hash]]:
    """Walk first-parent history from tip, newest first."""
    # TODO(5.1): log_walk
    raise NotImplementedError("TODO(5.1): log_walk")

