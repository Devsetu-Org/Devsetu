"""Bloom filters: compact bit arrays for "definitely not" / "maybe"."""

from __future__ import annotations

MIN_BITS = 64
MAX_PROBES = 30


class Builder:
    def __init__(self, bits_per_key: int) -> None:
        if bits_per_key < 1:
            bits_per_key = 1
        self.bits_per_key = bits_per_key
        self.hashes: list[int] = []

    def add(self, key: bytes) -> None:
        self.hashes.append(hash64(key))

    def finish(self) -> bytes:
        n_bits = len(self.hashes) * self.bits_per_key
        if n_bits < MIN_BITS:
            n_bits = MIN_BITS
        # TODO(4.1): round n_bits up to whole bytes (m = 8 * n_bytes). Allocate
        # n_bytes+1 bytes and store k = num_probes(self.bits_per_key) in the
        # last one. For every hash, set the k bits probe(h, i, m).
        raise NotImplementedError("TODO(4.1): finish")


def may_contain(filter_bytes: bytes, key: bytes) -> bool:
    # TODO(4.2): short/invalid filter => True. Else check k probes.
    raise NotImplementedError("TODO(4.2): may_contain")


def num_probes(bits_per_key: int) -> int:
    k = int(bits_per_key * 0.69)
    if k < 1:
        k = 1
    if k > MAX_PROBES:
        k = MAX_PROBES
    return k


def probe(h: int, i: int, m: int) -> int:
    h1, h2 = h & 0xFFFFFFFF, (h >> 32) & 0xFFFFFFFF
    return (h1 + i * h2) % m


def hash64(key: bytes) -> int:
    h = 14695981039346656037
    for c in key:
        h ^= c
        h = (h * 1099511628211) & 0xFFFFFFFFFFFFFFFF
    h ^= h >> 33
    h = (h * 0xFF51AFD7ED558CCD) & 0xFFFFFFFFFFFFFFFF
    h ^= h >> 33
    h = (h * 0xC4CEB9FE1A85EC53) & 0xFFFFFFFFFFFFFFFF
    h ^= h >> 33
    return h
