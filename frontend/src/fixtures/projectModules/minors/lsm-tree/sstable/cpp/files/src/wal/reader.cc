#include "wal/reader.h"

#include <fstream>

#include "wal/crc32c.h"

namespace lsmkv {
namespace wal {
namespace {

uint32_t ReadUint32LE(const char* p) {
  return uint32_t(uint8_t(p[0])) | (uint32_t(uint8_t(p[1])) << 8) |
         (uint32_t(uint8_t(p[2])) << 16) | (uint32_t(uint8_t(p[3])) << 24);
}

}  // namespace

int64_t Replay(const std::string& path, const std::function<void(const Record&)>& fn) {
  std::ifstream in(path, std::ios::binary);
  if (!in) {
    return 0;
  }
  std::string data((std::istreambuf_iterator<char>(in)), std::istreambuf_iterator<char>());
  int64_t good = 0;
  for (;;) {
    const size_t off = static_cast<size_t>(good);
    if (data.size() - off < kHeaderSize) {
      return good;
    }
    const char* rest = data.data() + off;
    const uint32_t sum = ReadUint32LE(rest);
    const uint32_t n = ReadUint32LE(rest + 4);
    if (n > kMaxRecordSize || n > data.size() - off - kHeaderSize) {
      return good;
    }
    std::string_view payload(rest + kHeaderSize, n);
    if (Checksum(payload) != sum) {
      return good;
    }
    Record r;
    try {
      r = DecodePayload(payload);
    } catch (const CorruptError&) {
      return good;
    }
    fn(r);
    good += static_cast<int64_t>(kHeaderSize + n);
  }
}

}  // namespace wal
}  // namespace lsmkv
