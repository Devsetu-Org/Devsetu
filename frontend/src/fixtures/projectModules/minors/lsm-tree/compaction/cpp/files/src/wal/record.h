#pragma once

// Package wal is the write-ahead log. Every write is appended here, and made
// durable, before it touches the memtable. On startup the log is replayed to
// rebuild the memtable the crash took away.
//
// One record on disk:
//
//   +-----------+-----------+-------------------+
//   | crc32 u32 | len u32   | payload (len)     |
//   +-----------+-----------+-------------------+
//
//   payload = kind u8 | uvarint keyLen | key | uvarint valueLen | value
//
// Integers are little-endian. The checksum (CRC-32C) covers the payload only.
// Kind on the wire matches Go: value=1, tombstone=2.

#include <cstdint>
#include <stdexcept>
#include <string>
#include <string_view>
#include <vector>

#include "memtable/skiplist.h"

namespace lsmkv {
namespace wal {

constexpr size_t kHeaderSize = 8;
// Rejects absurd lengths read from a damaged header before they turn into a
// huge allocation.
constexpr uint32_t kMaxRecordSize = 64u << 20;

class CorruptError : public std::runtime_error {
 public:
  CorruptError() : std::runtime_error("wal: corrupt record") {}
};

// Wire bytes for Kind. Must match Go's KindValue=1 / KindTombstone=2.
inline uint8_t KindToWire(Kind kind) {
  return kind == Kind::kTombstone ? 2 : 1;
}
inline bool KindFromWire(uint8_t b, Kind* out) {
  if (b == 1) {
    *out = Kind::kValue;
    return true;
  }
  if (b == 2) {
    *out = Kind::kTombstone;
    return true;
  }
  return false;
}

// One logged write.
struct Record {
  Kind kind = Kind::kValue;
  std::string key;
  std::string value;  // empty for tombstones
};

// Appends the payload encoding of r to dst.
void AppendPayload(std::string* dst, const Record& r);

// Inverse of AppendPayload.
Record DecodePayload(std::string_view p);

// Appends the full on-disk form of r (header and payload) to dst.
void Encode(std::string* dst, const Record& r);

}  // namespace wal
}  // namespace lsmkv
