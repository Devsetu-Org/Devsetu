"""Tree shell: load/store/new_page and entry checks."""

from __future__ import annotations

from dataclasses import dataclass

from btreekv.pager.page import PAGE_SIZE

from .node import MAX_KEY_SIZE, MAX_VALUE_SIZE, ErrCorrupt, Node, decode
from .store import PageIO

MAX_DEPTH = 64


class ErrEmptyKey(Exception):
    pass


class ErrKeyTooLarge(Exception):
    pass


class ErrValueTooLarge(Exception):
    pass


@dataclass
class Promoted:
    sep: bytes
    right: int


class Tree:
    """A B+ tree over a PageIO. Not safe for concurrent use."""

    def __init__(self, io: PageIO):
        self.io = io

    def load(self, no: int) -> Node:
        buf = bytearray(PAGE_SIZE)
        self.io.read_page(no, buf)
        try:
            return decode(buf)
        except ErrCorrupt as e:
            raise ErrCorrupt(f"page {no}: {e}") from e

    def store(self, no: int, n: Node) -> None:
        buf = bytearray(PAGE_SIZE)
        n.encode(buf)
        self.io.write_page(no, buf)

    def new_page(self, n: Node) -> int:
        no = self.io.allocate()
        self.store(no, n)
        return no


def check_entry(key: bytes, val: bytes) -> None:
    if len(key) == 0:
        raise ErrEmptyKey("btree: empty key")
    if len(key) > MAX_KEY_SIZE:
        raise ErrKeyTooLarge(f"btree: key too large: {len(key)} bytes, max {MAX_KEY_SIZE}")
    if len(val) > MAX_VALUE_SIZE:
        raise ErrValueTooLarge(f"btree: value too large: {len(val)} bytes, max {MAX_VALUE_SIZE}")


from . import insert as _insert  # noqa: E402
from . import search as _search  # noqa: E402

Node.child_index = _search.child_index  # type: ignore[method-assign, attr-defined]
Node.leaf_index = _search.leaf_index  # type: ignore[method-assign, attr-defined]
Tree.find_leaf = _search.find_leaf  # type: ignore[method-assign]
Tree.get = _search.get  # type: ignore[method-assign]
Node.leaf_put = _insert.leaf_put  # type: ignore[method-assign, attr-defined]
Node.split = _insert.split  # type: ignore[method-assign, attr-defined]
Tree.insert = _insert.insert_public  # type: ignore[method-assign]
Tree._insert = _insert.insert_rec  # type: ignore[method-assign]

from . import check as _check  # noqa: E402,F401

from . import balance as _balance  # noqa: E402,F401
from . import cursor as _cursor  # noqa: E402,F401
from . import delete as _delete  # noqa: E402
Tree._delete = _delete.delete_rec  # type: ignore[attr-defined]
Tree.rebalance = _delete.rebalance  # type: ignore[attr-defined]
Tree.delete = _delete.delete_public  # type: ignore[attr-defined]
