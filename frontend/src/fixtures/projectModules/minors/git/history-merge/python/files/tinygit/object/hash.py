"""SHA-1 object ids."""
from __future__ import annotations

import hashlib


class Hash:
    """A SHA-1 object id (20 bytes)."""

    __slots__ = ("_b",)

    def __init__(self, raw: bytes | None = None) -> None:
        if raw is None:
            self._b = bytes(20)
        else:
            if len(raw) != 20:
                raise ValueError(f"object: bad hash length {len(raw)}")
            self._b = bytes(raw)

    def hex(self) -> str:
        return self._b.hex()

    def __str__(self) -> str:
        return self.hex()

    def __repr__(self) -> str:
        return f"Hash({self.hex()!r})"

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, Hash):
            return NotImplemented
        return self._b == other._b

    def __hash__(self) -> int:
        return hash(self._b)

    def is_zero(self) -> bool:
        return self._b == bytes(20)

    def raw(self) -> bytes:
        return self._b


ZERO = Hash()


def hash_of(data: bytes) -> Hash:
    """Return the SHA-1 of data."""
    return Hash(hashlib.sha1(data).digest())


def parse_hex(s: str) -> Hash:
    """Parse a 40-character hex object id."""
    if len(s) != 40:
        raise ValueError(f"object: bad hash length {len(s)}")
    try:
        b = bytes.fromhex(s)
    except ValueError as e:
        raise ValueError(f"object: bad hash: {e}") from e
    return Hash(b)
