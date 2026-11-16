#include "btree/tree.h"

#include <stdexcept>

namespace btreekv {

int ChildIndex(const Node& n, std::string_view key) {
  // TODO(2.1)
  (void)n;
  (void)key;
  throw std::logic_error("TODO(2.1)");
}

std::pair<int, bool> LeafIndex(const Node& n, std::string_view key) {
  // TODO(2.1)
  (void)n;
  (void)key;
  throw std::logic_error("TODO(2.1)");
}

PageNo Tree::FindLeaf(std::string_view key, Node* out_leaf) {
  // TODO(2.2)
  (void)key;
  (void)out_leaf;
  throw std::logic_error("TODO(2.2)");
}

bool Tree::Get(std::string_view key, std::string* value) {
  // TODO(2.2)
  (void)key;
  (void)value;
  throw std::logic_error("TODO(2.2)");
}

}  // namespace btreekv
