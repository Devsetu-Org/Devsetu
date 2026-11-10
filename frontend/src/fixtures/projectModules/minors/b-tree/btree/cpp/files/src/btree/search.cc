#include "btree/tree.h"

#include <stdexcept>

namespace btreekv {

int ChildIndex(const Node& n, std::string_view key) {
  // TODO(2.1): Binary search n.keys for the first separator that is greater
  // than key. That index is the child to follow.
  (void)n;
  (void)key;
  throw std::logic_error("TODO(2.1): ChildIndex");
}

std::pair<int, bool> LeafIndex(const Node& n, std::string_view key) {
  // TODO(2.1): Binary search for the first key >= key; hit when equal.
  (void)n;
  (void)key;
  throw std::logic_error("TODO(2.1): LeafIndex");
}

PageNo Tree::FindLeaf(std::string_view key, Node* out_leaf) {
  // TODO(2.2): Walk from Root(); empty tree returns 0. Loop at most kMaxDepth.
  (void)key;
  (void)out_leaf;
  throw std::logic_error("TODO(2.2): FindLeaf");
}

bool Tree::Get(std::string_view key, std::string* value) {
  // TODO(2.2): FindLeaf then LeafIndex.
  (void)key;
  (void)value;
  throw std::logic_error("TODO(2.2): Get");
}

}  // namespace btreekv
