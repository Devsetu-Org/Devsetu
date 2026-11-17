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
  // TODO(3.3)
  (void)data;
  (void)len;
  (void)fn;
  throw std::logic_error("TODO(3.3)");
}

}  // namespace btreekv
