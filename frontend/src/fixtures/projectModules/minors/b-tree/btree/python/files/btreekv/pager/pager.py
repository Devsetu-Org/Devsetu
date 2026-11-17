"""Open, Sync, Close, and header state."""

from __future__ import annotations

import os
import threading

from .page import (
    PAGE_SIZE,
    Meta,
    decode_header,
    encode_header,
)


class Pager:
    """One page file. read_page and write_page are safe to call from many
    threads; allocate and free serialize on the header state.
    """

    def __init__(self, fd: int, meta: Meta):
        self._fd = fd
        self._mu = threading.Lock()
        self._meta = meta

    @classmethod
    def open(cls, path: str) -> Pager:
        """Open the page file at path, creating it (with an empty header) when
        it does not exist.
        """
        fd = os.open(path, os.O_RDWR | os.O_CREAT, 0o644)
        try:
            st = os.fstat(fd)
            if st.st_size == 0:
                p = cls(fd, Meta(page_count=1))
                p.sync()
                return p
            buf = bytearray(PAGE_SIZE)
            p = cls(fd, Meta(page_count=1))
            p.read_page(0, buf)
            p._meta = decode_header(buf)
            return p
        except Exception:
            os.close(fd)
            raise

    def meta(self) -> Meta:
        with self._mu:
            return Meta(
                root=self._meta.root,
                page_count=self._meta.page_count,
                free_head=self._meta.free_head,
            )

    def set_meta(self, m: Meta) -> None:
        with self._mu:
            self._meta = Meta(root=m.root, page_count=m.page_count, free_head=m.free_head)

    def root(self) -> int:
        return self.meta().root

    def set_root(self, no: int) -> None:
        with self._mu:
            self._meta.root = no

    def sync(self) -> None:
        buf = bytearray(PAGE_SIZE)
        encode_header(buf, self.meta())
        self.write_page(0, buf)
        os.fsync(self._fd)

    def close(self) -> None:
        try:
            self.sync()
        finally:
            os.close(self._fd)

    write_page = None  # type: ignore[assignment]
    read_page = None  # type: ignore[assignment]
    allocate = None  # type: ignore[assignment]
    free = None  # type: ignore[assignment]


from . import alloc as _alloc  # noqa: E402
from . import readwrite as _rw  # noqa: E402

Pager.write_page = _rw.write_page  # type: ignore[method-assign]
Pager.read_page = _rw.read_page  # type: ignore[method-assign]
Pager.allocate = _alloc.allocate  # type: ignore[method-assign]
Pager.free = _alloc.free  # type: ignore[method-assign]
