#include "wal/record.h"

#include <cstring>
#include <stdexcept>

namespace btreekv {
namespace {

void PutLE32(uint8_t* p, uint32_t v) {
  p[0] = uint8_t(v);
  p[1] = uint8_t(v >> 8);
  p[2] = uint8_t(v >> 16);
  p[3] = uint8_t(v >> 24);
}
uint32_t GetLE32(const uint8_t* p) {
  return uint32_t(p[0]) | (uint32_t(p[1]) << 8) | (uint32_t(p[2]) << 16) | (uint32_t(p[3]) << 24);
}

void AppendUvarint(std::vector<uint8_t>* dst, uint64_t n) {
  while (n >= 0x80) {
    dst->push_back(uint8_t(n) | 0x80);
    n >>= 7;
  }
  dst->push_back(uint8_t(n));
}

std::pair<uint64_t, int> ReadUvarint(const uint8_t* p, size_t len) {
  uint64_t result = 0;
  int shift = 0;
  for (size_t i = 0; i < len; ++i) {
    uint8_t b = p[i];
    result |= uint64_t(b & 0x7f) << shift;
    if (b < 0x80) return {result, int(i + 1)};
    shift += 7;
    if (shift >= 64) return {0, 0};
  }
  return {0, 0};
}

}  // namespace

void AppendPayload(std::vector<uint8_t>* dst, const Record& r) {
  dst->push_back(uint8_t(r.kind));
  size_t at = dst->size();
  dst->resize(at + 4);
  PutLE32(dst->data() + at, r.page);
  AppendUvarint(dst, r.data.size());
  dst->insert(dst->end(), r.data.begin(), r.data.end());
}

Record DecodePayload(const uint8_t* p, size_t len) {
  if (len < 6) throw BadPayloadError("wal: malformed record payload");
  WalKind kind = WalKind(p[0]);
  if (kind < WalKind::kPage || kind > WalKind::kCommit) {
    throw BadPayloadError("wal: malformed record payload");
  }
  uint32_t page = GetLE32(p + 1);
  auto [n, used] = ReadUvarint(p + 5, len - 5);
  if (used <= 0 || size_t(len - 5 - used) != n) {
    throw BadPayloadError("wal: malformed record payload");
  }
  Record r;
  r.kind = kind;
  r.page = page;
  r.data.assign(reinterpret_cast<const char*>(p + 5 + used), n);
  return r;
}

void Encode(std::vector<uint8_t>* dst, const Record& r) {
  size_t start = dst->size();
  dst->resize(start + kWalHeaderSize, 0);
  AppendPayload(dst, r);
  const uint8_t* payload = dst->data() + start + kWalHeaderSize;
  size_t plen = dst->size() - start - kWalHeaderSize;
  PutLE32(dst->data() + start, Crc32c(payload, plen));
  PutLE32(dst->data() + start + 4, uint32_t(plen));
}

Record MetaRecord(uint32_t root, uint32_t page_count, uint32_t free_head) {
  Record r;
  r.kind = WalKind::kMeta;
  r.data.assign(12, '\0');
  PutLE32(reinterpret_cast<uint8_t*>(&r.data[0]), root);
  PutLE32(reinterpret_cast<uint8_t*>(&r.data[4]), page_count);
  PutLE32(reinterpret_cast<uint8_t*>(&r.data[8]), free_head);
  return r;
}

Record CommitRecord() {
  Record r;
  r.kind = WalKind::kCommit;
  return r;
}

void UnpackMeta(const Record& r, uint32_t* root, uint32_t* page_count, uint32_t* free_head) {
  if (r.kind != WalKind::kMeta || r.data.size() != 12) {
    throw std::runtime_error("wal: not a meta record");
  }
  const auto* p = reinterpret_cast<const uint8_t*>(r.data.data());
  *root = GetLE32(p);
  *page_count = GetLE32(p + 4);
  *free_head = GetLE32(p + 8);
}

}  // namespace btreekv
