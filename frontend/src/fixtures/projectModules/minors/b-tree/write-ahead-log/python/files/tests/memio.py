"""In-memory PageIO for btree unit tests."""

from __future__ import annotations

from btreekv.pager.page import PAGE_SIZE


class MemIO:
    def __init__(self) -> None:
        self.pages: dict[int, bytearray] = {}
        self.next = 1
        self.free: list[int] = []
        self._root = 0
        self.reads = 0
        self.writes = 0

    def read_page(self, no: int, buf: bytearray) -> None:
        if no not in self.pages:
            raise RuntimeError(f"memIO: read of page {no}, which is not allocated")
        self.reads += 1
        buf[:] = self.pages[no]

    def write_page(self, no: int, buf: bytes | bytearray) -> None:
        if no not in self.pages:
            raise RuntimeError(f"memIO: write to page {no}, which is not allocated")
        self.writes += 1
        self.pages[no] = bytearray(buf)

    def allocate(self) -> int:
        if self.free:
            no = self.free.pop()
        else:
            no = self.next
            self.next += 1
        self.pages[no] = bytearray(PAGE_SIZE)
        return no

    def free(self, no: int) -> None:
        if no not in self.pages:
            raise RuntimeError(f"memIO: free of page {no}, which is not allocated")
        del self.pages[no]
        self.free.append(no)

    def root(self) -> int:
        return self._root

    def set_root(self, no: int) -> None:
        self._root = no

    def live(self) -> int:
        return len(self.pages)
