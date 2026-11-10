"""CRC-32C (Castagnoli). Same polynomial RocksDB, LevelDB, and Go's
hash/crc32.Castagnoli use. Pure Python, no third-party packages."""

from __future__ import annotations

# Castagnoli polynomial 0x1EDC6F41, reflected.
_POLY = 0x82F63B78


def _make_table() -> list[int]:
    table = []
    for i in range(256):
        crc = i
        for _ in range(8):
            if crc & 1:
                crc = (crc >> 1) ^ _POLY
            else:
                crc >>= 1
        table.append(crc)
    return table


_TABLE = _make_table()


def checksum(data: bytes) -> int:
    """CRC-32C of data, as an unsigned 32-bit int."""
    crc = 0xFFFFFFFF
    for b in data:
        crc = _TABLE[(crc ^ b) & 0xFF] ^ (crc >> 8)
    return (crc ^ 0xFFFFFFFF) & 0xFFFFFFFF
