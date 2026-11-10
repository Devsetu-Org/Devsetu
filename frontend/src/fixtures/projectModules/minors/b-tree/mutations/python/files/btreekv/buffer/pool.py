"""Buffer pool shell: frames, Fetch, FlushAll, PageIO surface."""

from __future__ import annotations

import threading
from dataclasses import dataclass, field
from typing import Optional, Protocol

from btreekv.pager.page import PAGE_SIZE, USABLE, Meta


class ErrPoolFull(Exception):
    pass


class Backing(Protocol):
    def read_page(self, no: int, buf: bytearray) -> None: ...
    def write_page(self, no: int, buf: bytes | bytearray) -> None: ...
    def allocate(self) -> int: ...
    def free(self, no: int) -> None: ...
    def meta(self) -> Meta: ...
    def set_meta(self, m: Meta) -> None: ...


class Log(Protocol):
    def size(self) -> int: ...
    def durable(self) -> int: ...
    def sync(self) -> None: ...


@dataclass
class Frame:
    no: int = 0
    data: bytearray = field(default_factory=lambda: bytearray(PAGE_SIZE))
    used: bool = False
    pins: int = 0
    ref: bool = False
    dirty: bool = False
    lsn: int = 0


class Pool:
    def __init__(self, b: Backing, frames: int):
        frames = max(frames, 2)
        self._mu = threading.Lock()
        self.b = b
        self.log: Optional[Log] = None
        self.frames = [Frame() for _ in range(frames)]
        self.table: dict[int, int] = {}
        self.hand = 0

    def set_log(self, log: Log) -> None:
        with self._mu:
            self.log = log

    def log_size(self) -> int:
        return 0 if self.log is None else self.log.size()

    def fetch(self, no: int) -> Frame:
        return self.pin(no, True)

    def flush_all(self) -> None:
        with self._mu:
            for f in self.frames:
                if f.used:
                    self.flush_frame(f)

    def resident(self) -> int:
        with self._mu:
            return len(self.table)

    def dirty_count(self) -> int:
        with self._mu:
            return sum(1 for f in self.frames if f.used and f.dirty)

    def read_page(self, no: int, buf: bytearray) -> None:
        f = self.pin(no, True)
        buf[:] = f.data
        self.unpin(f, False)

    def write_page(self, no: int, buf: bytes | bytearray) -> None:
        f = self.pin(no, False)
        f.data[:USABLE] = buf[:USABLE]
        self.unpin(f, True)

    def allocate(self) -> int:
        with self._mu:
            head = self.b.meta().free_head
            if head != 0 and head in self.table:
                self.flush_frame(self.frames[self.table[head]])
        return self.b.allocate()

    def free(self, no: int) -> None:
        with self._mu:
            if no in self.table:
                i = self.table[no]
                if self.frames[i].pins == 0:
                    self.frames[i] = Frame()
                    del self.table[no]
        self.b.free(no)

    def meta(self) -> Meta:
        return self.b.meta()

    def set_meta(self, m: Meta) -> None:
        self.b.set_meta(m)

    def root(self) -> int:
        return self.b.meta().root

    def set_root(self, no: int) -> None:
        m = self.b.meta()
        m.root = no
        self.b.set_meta(m)

    # Student methods attached below
    pin = None  # type: ignore[assignment]
    unpin = None  # type: ignore[assignment]
    victim = None  # type: ignore[assignment]
    flush_frame = None  # type: ignore[assignment]


from . import evict as _evict  # noqa: E402
from . import flush as _flush  # noqa: E402
from . import pin as _pin  # noqa: E402

Pool.pin = _pin.pin  # type: ignore[method-assign]
Pool.unpin = _pin.unpin  # type: ignore[method-assign]
Pool.victim = _evict.victim  # type: ignore[method-assign]
Pool.flush_frame = _flush.flush_frame  # type: ignore[method-assign]
