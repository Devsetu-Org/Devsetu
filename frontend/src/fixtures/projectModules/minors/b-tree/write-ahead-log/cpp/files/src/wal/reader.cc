#include "wal/reader.h"

#include <fstream>
#include <stdexcept>

namespace btreekv {
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
  // TODO(3.3): Loop. If fewer than kWalHeaderSize bytes remain, return good.
  // Read crc and length. If length is absurd or payload does not fit, return.
  // If Crc32c(payload) != sum, return. DecodePayload; on BadPayload return.
  // Call fn(r, end) then advance good.
  (void)data;
  (void)len;
  (void)fn;
  throw std::logic_error("TODO(3.3): Scan");
}

}  // namespace btreekv
