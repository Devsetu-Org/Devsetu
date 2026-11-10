#include "btree/tree.h"

namespace btreekv {

std::pair<bool, bool> Tree::DeleteRec(PageNo no, std::string_view key) {
  Node n = Load(no);
  if (n.leaf) {
    auto [i, ok] = LeafIndex(n, key);
    if (!ok) return {false, false};
    n.RemoveLeafAt(i);
    Store(no, n);
    return {true, n.Underfull()};
  }
  int i = ChildIndex(n, key);
  auto [found, child_under] = DeleteRec(n.children[size_t(i)], key);
  if (!found || !child_under) return {found, false};
  Rebalance(no, n, i);
  return {true, n.Underfull()};
}

void Tree::Rebalance(PageNo parent_no, Node& parent, int i) {
  int li = i > 0 ? i - 1 : i;
  PageNo left_no = parent.children[size_t(li)];
  PageNo right_no = parent.children[size_t(li + 1)];
  std::string sep = parent.keys[size_t(li)];
  Node left = Load(left_no);
  Node right = Load(right_no);
  if (CanMerge(left, right, sep)) {
    MergeNodes(&left, right, sep);
    Store(left_no, left);
    io_->Free(right_no);
    parent.RemoveChild(li);
  } else {
    parent.keys[size_t(li)] = Redistribute(&left, &right, sep);
    Store(left_no, left);
    Store(right_no, right);
  }
  Store(parent_no, parent);
}

bool Tree::Delete(std::string_view key) {
  PageNo root = io_->Root();
  if (root == 0 || key.empty()) return false;
  auto [found, _] = DeleteRec(root, key);
  if (!found) return false;
  while (true) {
    root = io_->Root();
    if (root == 0) return true;
    Node n = Load(root);
    if (n.leaf && n.keys.empty()) {
      io_->SetRoot(0);
    } else if (!n.leaf && n.keys.empty()) {
      io_->SetRoot(n.children[0]);
    } else {
      return true;
    }
    io_->Free(root);
  }
}

}  // namespace btreekv
