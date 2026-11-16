#include "wal/reader.h"

#include <fstream>
#include <stdexcept>

namespace lsmkv {
namespace wal {

int64_t Replay(const std::string& path, const std::function<void(const Record&)>& fn) {
  std::ifstream in(path, std::ios::binary);
  if (!in) {
    // Missing file is an empty log.
    return 0;
  }
  std::string data((std::istreambuf_iterator<char>(in)), std::istreambuf_iterator<char>());
  // TODO(2.3)
  (void)fn;
  (void)data;
  throw std::logic_error("TODO(2.3)");
}

}  // namespace wal
}  // namespace lsmkv
