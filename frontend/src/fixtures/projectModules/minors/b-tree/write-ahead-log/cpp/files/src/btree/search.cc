#include "btree/tree.h"

#include <algorithm>

namespace btreekv {

int ChildIndex(const Node& n, std::string_view key) {
  auto it = std::upper_bound(n.keys.begin(), n.keys.end(), key);
  return int(it - n.keys.begin());
}

std::pair<int, bool> LeafIndex(const Node& n, std::string_view key) {
  auto it = std::lower_bound(n.keys.begin(), n.keys.end(), key);
  int i = int(it - n.keys.begin());
  bool found = it != n.keys.end() && *it == key;
  return {i, found};
}

PageNo Tree::FindLeaf(std::string_view key, Node* out_leaf) {
  PageNo no = io_->Root();
  if (no == 0) return 0;
  for (int depth = 0; depth < kMaxDepth; ++depth) {
    Node n = Load(no);
    if (n.leaf) {
      if (out_leaf) *out_leaf = std::move(n);
      return no;
    }
    no = n.children[ChildIndex(n, key)];
  }
  throw CorruptError("btree: corrupt page");
}

bool Tree::Get(std::string_view key, std::string* value) {
  Node leaf;
  PageNo no = FindLeaf(key, &leaf);
  if (no == 0) return false;
  auto [i, found] = LeafIndex(leaf, key);
  if (!found) return false;
  if (value) *value = leaf.vals[i];
  return true;
}

}  // namespace btreekv
