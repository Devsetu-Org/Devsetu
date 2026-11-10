#include "object/commit.h"
#include <sstream>
#include <stdexcept>

namespace tinygit {

std::vector<uint8_t> EncodeCommit(const Commit& c) {
  // TODO(1.5): EncodeCommit
  throw std::runtime_error("TODO(1.5): EncodeCommit");
}

Commit DecodeCommit(const std::vector<uint8_t>& content) {
  // TODO(1.5): DecodeCommit
  throw std::runtime_error("TODO(1.5): DecodeCommit");
}

Hash PutCommit(Store s, const Commit& c) { return s.Put(kTypeCommit, EncodeCommit(c)); }

Commit GetCommit(Store s, const Hash& h) {
  auto pr = s.Get(h);
  if (pr.first != kTypeCommit) throw std::runtime_error(std::string("object: want commit got ") + pr.first);
  return DecodeCommit(pr.second);
}

}  // namespace tinygit
