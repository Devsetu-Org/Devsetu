#include "object/blob.h"
#include <stdexcept>

namespace tinygit {

Hash PutBlob(Store s, const std::vector<uint8_t>& data) {
  // TODO(1.3): PutBlob
  throw std::runtime_error("TODO(1.3): PutBlob");
}

std::vector<uint8_t> GetBlob(Store s, const Hash& h) {
  // TODO(1.3): GetBlob
  throw std::runtime_error("TODO(1.3): GetBlob");
}

}  // namespace tinygit
