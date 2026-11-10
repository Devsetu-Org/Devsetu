"""The write-ahead log. Every write is appended here, and made durable, before
it touches the memtable. On startup the log is replayed to rebuild the
memtable the crash took away."""

from .reader import replay
from .record import Record, encode
from .writer import SyncMode, Writer, create, open_append

__all__ = [
    "Record",
    "SyncMode",
    "Writer",
    "create",
    "encode",
    "open_append",
    "replay",
]
