#include "pager/page.h"

#include <cstring>

namespace btreekv {
namespace {

constexpr uint8_t kHeaderMagic[4] = {'B', 'T', 'K', 'V'};
constexpr uint32_t kHeaderVersion = 1;
constexpr uint8_t kFreeMagic[4] = {'F', 'R', 'E', 'E'};

// Reflected Castagnoli polynomial table (matches Go hash/crc32.Castagnoli).
uint32_t MakeCrcEntry(uint32_t i) {
  constexpr uint32_t kPoly = 0x82F63B78u;
  uint32_t crc = i;
  for (int b = 0; b < 8; ++b) {
    crc = (crc & 1u) ? (crc >> 1) ^ kPoly : (crc >> 1);
  }
  return crc;
}

const uint32_t* CrcTable() {
  static uint32_t table[256];
  static bool ready = false;
  if (!ready) {
    for (uint32_t i = 0; i < 256; ++i) table[i] = MakeCrcEntry(i);
    ready = true;
  }
  return table;
}

void PutLE32(uint8_t* p, uint32_t v) {
  p[0] = static_cast<uint8_t>(v);
  p[1] = static_cast<uint8_t>(v >> 8);
  p[2] = static_cast<uint8_t>(v >> 16);
  p[3] = static_cast<uint8_t>(v >> 24);
}

uint32_t GetLE32(const uint8_t* p) {
  return uint32_t(p[0]) | (uint32_t(p[1]) << 8) | (uint32_t(p[2]) << 16) | (uint32_t(p[3]) << 24);
}

}  // namespace

uint32_t Crc32c(const uint8_t* data, size_t len) {
  const uint32_t* table = CrcTable();
  uint32_t crc = 0xFFFFFFFFu;
  for (size_t i = 0; i < len; ++i) {
    crc = table[(crc ^ data[i]) & 0xFFu] ^ (crc >> 8);
  }
  return crc ^ 0xFFFFFFFFu;
}

void EncodeHeader(uint8_t* buf, const Meta& m) {
  std::memset(buf, 0, kPageSize);
  std::memcpy(buf, kHeaderMagic, 4);
  PutLE32(buf + 4, kHeaderVersion);
  PutLE32(buf + 8, kPageSize);
  PutLE32(buf + 12, m.root);
  PutLE32(buf + 16, m.page_count);
  PutLE32(buf + 20, m.free_head);
}

Meta DecodeHeader(const uint8_t* buf) {
  if (std::memcmp(buf, kHeaderMagic, 4) != 0) {
    throw CorruptError("pager: corrupt file: bad magic");
  }
  uint32_t version = GetLE32(buf + 4);
  if (version != kHeaderVersion) {
    throw CorruptError("pager: corrupt file: unsupported version");
  }
  uint32_t ps = GetLE32(buf + 8);
  if (ps != kPageSize) {
    throw CorruptError("pager: corrupt file: bad page size");
  }
  Meta m;
  m.root = GetLE32(buf + 12);
  m.page_count = GetLE32(buf + 16);
  m.free_head = GetLE32(buf + 20);
  if (m.page_count < 1) {
    throw CorruptError("pager: corrupt file: page count 0");
  }
  return m;
}

void EncodeFreePage(uint8_t* buf, PageNo next) {
  std::memset(buf, 0, kPageSize);
  std::memcpy(buf, kFreeMagic, 4);
  PutLE32(buf + 4, next);
}

PageNo DecodeFreePage(const uint8_t* buf) {
  if (std::memcmp(buf, kFreeMagic, 4) != 0) {
    throw CorruptError("pager: corrupt file: page on the freelist is not a free page");
  }
  return GetLE32(buf + 4);
}

void CheckBuf(const uint8_t* /*buf*/, size_t len) {
  if (len != kPageSize) {
    throw BadPageError("pager: bad page: buffer size");
  }
}

}  // namespace btreekv
