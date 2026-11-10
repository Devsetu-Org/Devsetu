#include "object/tree.h"
#include <algorithm>
#include <stdexcept>

namespace tinygit {

std::vector<uint8_t> EncodeTree(std::vector<TreeEntry> entries) {
  // TODO(1.4): EncodeTree
  throw std::runtime_error("TODO(1.4): EncodeTree");
}

std::vector<TreeEntry> DecodeTree(const std::vector<uint8_t>& content) {
  // TODO(1.4): DecodeTree
  throw std::runtime_error("TODO(1.4): DecodeTree");
}

Hash PutTree(Store s, const std::vector<TreeEntry>& entries) {
  return s.Put(kTypeTree, EncodeTree(entries));
}

std::vector<TreeEntry> GetTree(Store s, const Hash& h) {
  auto pr = s.Get(h);
  if (pr.first != kTypeTree) throw std::runtime_error(std::string("object: want tree got ") + pr.first);
  return DecodeTree(pr.second);
}

}  // namespace tinygit
