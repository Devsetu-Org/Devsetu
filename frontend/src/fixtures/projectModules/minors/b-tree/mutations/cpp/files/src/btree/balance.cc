#include "btree/tree.h"

namespace btreekv {

std::string Redistribute(Node* left, Node* right, std::string_view sep) {
  PageNo next = left->next;
  MergeNodes(left, *right, sep);
  auto [rn, new_sep] = Split(*left);
  left->next = next;
  *right = std::move(rn);
  return new_sep;
}

}  // namespace btreekv
