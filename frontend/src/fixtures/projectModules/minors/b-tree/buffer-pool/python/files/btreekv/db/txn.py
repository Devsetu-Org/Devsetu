"""In-memory write transaction over a store."""

from __future__ import annotations

from typing import TYPE_CHECKING

from btreekv.pager.page import PAGE_SIZE, USABLE, Meta, encode_free_page
from btreekv.wal.meta import commit_record, meta_record
from btreekv.wal.record import Kind, Record

if TYPE_CHECKING:
    from typing import Protocol

    class Store(Protocol):
        def read_page(self, no: int, buf: bytearray) -> None: ...
        def write_page(self, no: int, buf: bytes | bytearray) -> None: ...
        def allocate(self) -> int: ...
        def free(self, no: int) -> None: ...
        def root(self) -> int: ...
        def set_root(self, no: int) -> None: ...
        def meta(self) -> Meta: ...
        def set_meta(self, m: Meta) -> None: ...


class Txn:
    def __init__(self, base: "Store"):
        self.base = base
        self.start = base.meta()
        self.pages: dict[int, bytearray] = {}
        self.freed: list[int] = []
        self._root = self.start.root

    def read_page(self, no: int, buf: bytearray) -> None:
        if no in self.pages:
            buf[:] = self.pages[no]
            return
        if no in self.freed:
            raise RuntimeError(f"db: read of page {no} after it was freed")
        self.base.read_page(no, buf)

    def write_page(self, no: int, buf: bytes | bytearray) -> None:
        if len(buf) != PAGE_SIZE:
            raise RuntimeError(f"db: write of a {len(buf)}-byte buffer")
        self.pages[no] = bytearray(buf)

    def allocate(self) -> int:
        return self.base.allocate()

    def free(self, no: int) -> None:
        self.pages.pop(no, None)
        self.freed.append(no)

    def root(self) -> int:
        return self._root

    def set_root(self, no: int) -> None:
        self._root = no

    def dirty(self) -> bool:
        return bool(self.pages) or bool(self.freed) or self._root != self.start.root

    def abort(self) -> None:
        self.base.set_meta(self.start)

    def records(self) -> list[Record]:
        meta = self.base.meta()
        meta.root = self._root
        for no in self.freed:
            img = bytearray(PAGE_SIZE)
            encode_free_page(img, meta.free_head)
            self.pages[no] = img
            meta.free_head = no
        nos = sorted(self.pages)
        recs: list[Record] = []
        for no in nos:
            recs.append(Record(kind=Kind.PAGE, page=no, data=bytes(self.pages[no][:USABLE])))
        recs.append(meta_record(meta.root, meta.page_count, meta.free_head))
        recs.append(commit_record())
        return recs
