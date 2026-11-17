"""Node codec: decode/encode B+ tree pages."""

from __future__ import annotations

import struct
from dataclasses import dataclass, field

from btreekv.pager.page import PAGE_SIZE, USABLE

MAX_KEY_SIZE = 128
MAX_VALUE_SIZE = 1024

_TYPE_LEAF = 1
_TYPE_INTERNAL = 2
_HEADER_SIZE = 8
CAPACITY = USABLE - _HEADER_SIZE


@dataclass
class Node:
    leaf: bool = False
    keys: list[bytes] = field(default_factory=list)
    vals: list[bytes] = field(default_factory=list)  # leaf only
    children: list[int] = field(default_factory=list)  # internal only
    next: int = 0  # leaf only

    def cell_size(self, i: int) -> int:
        if self.leaf:
            return 4 + len(self.keys[i]) + len(self.vals[i])
        return 2 + len(self.keys[i]) + 4

    def size(self) -> int:
        return sum(self.cell_size(i) for i in range(len(self.keys)))

    def fits(self) -> bool:
        return self.size() <= CAPACITY

    def split_point(self) -> int:
        total = self.size()
        acc = 0
        for i in range(len(self.keys)):
            c = self.cell_size(i)
            if self.leaf:
                acc += c
                if acc >= total // 2:
                    return min(max(i + 1, 1), len(self.keys) - 1)
                continue
            if acc + c >= total // 2:
                return min(max(i, 1), len(self.keys) - 2)
            acc += c
        return len(self.keys) // 2

    def insert_child(self, i: int, sep: bytes, right: int) -> None:
        self.keys.insert(i, sep)
        self.children.insert(i + 1, right)

    def encode(self, buf: bytearray) -> None:
        if not self.fits():
            raise RuntimeError(f"btree: node of {self.size()} bytes does not fit in a page ({CAPACITY})")
        for i in range(PAGE_SIZE):
            buf[i] = 0
        if self.leaf:
            buf[0] = _TYPE_LEAF
            struct.pack_into("<I", buf, 4, self.next)
        else:
            buf[0] = _TYPE_INTERNAL
            struct.pack_into("<I", buf, 4, self.children[-1])
        struct.pack_into("<H", buf, 2, len(self.keys))
        off = _HEADER_SIZE
        for i, k in enumerate(self.keys):
            struct.pack_into("<H", buf, off, len(k))
            off += 2
            if self.leaf:
                struct.pack_into("<H", buf, off, len(self.vals[i]))
                off += 2
            buf[off : off + len(k)] = k
            off += len(k)
            if self.leaf:
                v = self.vals[i]
                buf[off : off + len(v)] = v
                off += len(v)
            else:
                struct.pack_into("<I", buf, off, self.children[i])
                off += 4


class ErrCorrupt(Exception):
    pass


def decode(buf: bytes | bytearray) -> Node:
    n = Node()
    if buf[0] == _TYPE_LEAF:
        n.leaf = True
        n.next = struct.unpack_from("<I", buf, 4)[0]
    elif buf[0] == _TYPE_INTERNAL:
        n.leaf = False
    else:
        raise ErrCorrupt(f"page type {buf[0]:#x}")
    count = struct.unpack_from("<H", buf, 2)[0]
    off = _HEADER_SIZE

    def need(k: int) -> None:
        if off + k > USABLE:
            raise ErrCorrupt("cell runs past the end of the page")

    for _ in range(count):
        need(2)
        kl = struct.unpack_from("<H", buf, off)[0]
        off += 2
        vl = 0
        if n.leaf:
            need(2)
            vl = struct.unpack_from("<H", buf, off)[0]
            off += 2
        need(kl + vl)
        n.keys.append(bytes(buf[off : off + kl]))
        off += kl
        if n.leaf:
            n.vals.append(bytes(buf[off : off + vl]))
            off += vl
            continue
        need(4)
        n.children.append(struct.unpack_from("<I", buf, off)[0])
        off += 4
    if not n.leaf:
        n.children.append(struct.unpack_from("<I", buf, 4)[0])
    return n
