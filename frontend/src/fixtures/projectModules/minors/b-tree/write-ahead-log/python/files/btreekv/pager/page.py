"""Page size, header layout, free-page layout, and CRC-32C."""

from __future__ import annotations

import struct
from dataclasses import dataclass

PAGE_SIZE = 4096
TRAILER_SIZE = 4
USABLE = PAGE_SIZE - TRAILER_SIZE

# Castagnoli polynomial, reflected — same checksum the WAL uses.
_CRC_POLY = 0x82F63B78


def _make_crc_table() -> list[int]:
    table: list[int] = []
    for i in range(256):
        crc = i
        for _ in range(8):
            crc = (crc >> 1) ^ _CRC_POLY if crc & 1 else crc >> 1
        table.append(crc & 0xFFFFFFFF)
    return table


_CRC_TABLE = _make_crc_table()


def crc32c(data: bytes | bytearray | memoryview) -> int:
    """CRC-32C (Castagnoli), matching Go's hash/crc32.Castagnoli."""
    crc = 0xFFFFFFFF
    for b in data:
        crc = _CRC_TABLE[(crc ^ b) & 0xFF] ^ (crc >> 8)
    return (crc ^ 0xFFFFFFFF) & 0xFFFFFFFF


class ErrChecksum(Exception):
    """A page read back does not match its checksum."""


class ErrBadPage(Exception):
    """A page number or buffer size that cannot be right."""


class ErrCorrupt(Exception):
    """The file is not a btreekv page file."""


@dataclass
class Meta:
    """The small amount of state the header page keeps."""

    root: int = 0
    page_count: int = 0
    free_head: int = 0


_HEADER_MAGIC = b"BTKV"
_HEADER_VERSION = 1
_FREE_MAGIC = b"FREE"


def encode_header(buf: bytearray | memoryview, m: Meta) -> None:
    """Lay m out in buf, a PAGE_SIZE page."""
    if len(buf) < PAGE_SIZE:
        raise ErrBadPage(f"buffer is {len(buf)} bytes, want {PAGE_SIZE}")
    for i in range(PAGE_SIZE):
        buf[i] = 0
    buf[0:4] = _HEADER_MAGIC
    struct.pack_into("<III", buf, 4, _HEADER_VERSION, PAGE_SIZE, m.root)
    struct.pack_into("<II", buf, 16, m.page_count, m.free_head)


def decode_header(buf: bytes | bytearray | memoryview) -> Meta:
    if bytes(buf[0:4]) != _HEADER_MAGIC:
        raise ErrCorrupt("bad magic")
    version, page_size, root, page_count, free_head = struct.unpack_from("<IIIII", buf, 4)
    if version != _HEADER_VERSION:
        raise ErrCorrupt(f"unsupported version {version}")
    if page_size != PAGE_SIZE:
        raise ErrCorrupt(f"page size {page_size}, want {PAGE_SIZE}")
    if page_count < 1:
        raise ErrCorrupt("page count 0")
    return Meta(root=root, page_count=page_count, free_head=free_head)


def encode_free_page(buf: bytearray | memoryview, next_no: int) -> None:
    """Lay out a free page: a marker and the next free page number (0 ends the list)."""
    for i in range(PAGE_SIZE):
        buf[i] = 0
    buf[0:4] = _FREE_MAGIC
    struct.pack_into("<I", buf, 4, next_no)


def decode_free_page(buf: bytes | bytearray | memoryview) -> int:
    if bytes(buf[0:4]) != _FREE_MAGIC:
        raise ErrCorrupt("page on the freelist is not a free page")
    return struct.unpack_from("<I", buf, 4)[0]


def check_buf(buf: bytes | bytearray | memoryview) -> None:
    if len(buf) != PAGE_SIZE:
        raise ErrBadPage(f"buffer is {len(buf)} bytes, want {PAGE_SIZE}")
