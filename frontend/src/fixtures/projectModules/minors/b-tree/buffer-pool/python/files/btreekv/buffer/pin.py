"""Pin / Unpin — student task 4.1."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .pool import Frame, Pool


def pin(self: Pool, no: int, load: bool) -> Frame:
    with self._mu:
        # TODO(4.1)
        raise NotImplementedError("TODO(4.1)")


def unpin(self: Pool, f: Frame, dirty: bool) -> None:
    with self._mu:
        # TODO(4.1)
        raise NotImplementedError("TODO(4.1)")
