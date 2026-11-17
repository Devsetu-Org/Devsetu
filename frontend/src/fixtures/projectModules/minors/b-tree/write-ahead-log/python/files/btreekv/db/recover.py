"""Recover and commit — student task 3.4."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .db import DB
    from .txn import Txn


def recover_log(self: DB) -> None:
    # TODO(3.4)
    raise NotImplementedError("TODO(3.4)")


def commit(self: DB, t: Txn) -> None:
    # TODO(3.4)
    raise NotImplementedError("TODO(3.4)")
