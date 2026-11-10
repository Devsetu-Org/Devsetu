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
  // TODO(2.3): walk data one record at a time from offset good. Stop and
  // return good when fewer than kHeaderSize bytes remain, the length is over
  // kMaxRecordSize or runs past the end, the checksum does not match, or
  // DecodePayload throws. Otherwise call fn and advance good past the record.
  (void)fn;
  (void)data;
  throw std::logic_error("TODO(2.3): Replay");
}

}  // namespace wal
}  // namespace lsmkv
