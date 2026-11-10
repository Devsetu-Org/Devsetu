#include "wal/reader.h"

#include <fstream>
#include <stdexcept>

namespace btreekv {
namespace {
uint32_t GetLE32(const uint8_t* p) {
  return uint32_t(p[0]) | (uint32_t(p[1]) << 8) | (uint32_t(p[2]) << 16) | (uint32_t(p[3]) << 24);
}
}  // namespace

int64_t Replay(const std::string& path,
               const std::function<void(const Record&, int64_t)>& fn) {
  std::ifstream in(path, std::ios::binary);
  if (!in) return 0;
  in.seekg(0, std::ios::end);
  auto sz = in.tellg();
  if (sz <= 0) return 0;
  in.seekg(0, std::ios::beg);
  std::vector<uint8_t> data(static_cast<size_t>(sz));
  in.read(reinterpret_cast<char*>(data.data()), sz);
  return Scan(data.data(), data.size(), fn);
}

int64_t Scan(const uint8_t* data, size_t len,
             const std::function<void(const Record&, int64_t)>& fn) {
  int64_t good = 0;
  while (true) {
    size_t rest = len - size_t(good);
    if (rest < kWalHeaderSize) return good;
    const uint8_t* p = data + good;
    uint32_t sum = GetLE32(p);
    uint32_t n = GetLE32(p + 4);
    if (n > kMaxRecordSize || kWalHeaderSize + n > rest) return good;
    const uint8_t* payload = p + kWalHeaderSize;
    if (Crc32c(payload, n) != sum) return good;
    Record r;
    try {
      r = DecodePayload(payload, n);
    } catch (const BadPayloadError&) {
      return good;
    }
    int64_t end = good + int64_t(kWalHeaderSize + n);
    fn(r, end);
    good = end;
  }
}

}  // namespace btreekv
