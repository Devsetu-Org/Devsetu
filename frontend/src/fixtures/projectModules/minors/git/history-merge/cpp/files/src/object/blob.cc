#include "object/blob.h"
#include <stdexcept>

namespace tinygit {

Hash PutBlob(Store s, const std::vector<uint8_t>& data) { return s.Put(kTypeBlob, data); }

std::vector<uint8_t> GetBlob(Store s, const Hash& h) {
  auto pr = s.Get(h);
  if (pr.first != kTypeBlob) throw std::runtime_error(std::string("object: want blob got ") + pr.first);
  return pr.second;
}

}  // namespace tinygit
