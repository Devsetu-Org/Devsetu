#include "btree/tree.h"

#include <vector>

namespace btreekv {

Node Tree::Load(PageNo no) {
  std::vector<uint8_t> buf(kPageSize);
  io_->ReadPage(no, buf.data(), buf.size());
  return Decode(buf.data());
}

void Tree::Store(PageNo no, const Node& n) {
  std::vector<uint8_t> buf(kPageSize);
  n.Encode(buf.data());
  io_->WritePage(no, buf.data(), buf.size());
}

PageNo Tree::NewPage(const Node& n) {
  PageNo no = io_->Allocate();
  Store(no, n);
  return no;
}

void CheckEntry(std::string_view key, std::string_view val) {
  if (key.empty()) throw EmptyKeyError("btree: empty key");
  if (key.size() > kMaxKeySize) throw KeyTooLargeError("btree: key too large");
  if (val.size() > kMaxValueSize) throw ValueTooLargeError("btree: value too large");
}

}  // namespace btreekv
