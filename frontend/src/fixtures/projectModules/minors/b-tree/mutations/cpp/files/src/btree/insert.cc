#include "btree/tree.h"

namespace btreekv {

void LeafPut(Node& n, std::string_view key, std::string_view val) {
  auto [i, found] = LeafIndex(n, key);
  if (found) {
    n.vals[i] = std::string(val);
    return;
  }
  n.keys.insert(n.keys.begin() + i, std::string(key));
  n.vals.insert(n.vals.begin() + i, std::string(val));
}

std::pair<Node, std::string> Split(Node& n) {
  int at = n.SplitPoint();
  if (n.leaf) {
    Node right;
    right.leaf = true;
    right.keys.assign(n.keys.begin() + at, n.keys.end());
    right.vals.assign(n.vals.begin() + at, n.vals.end());
    right.next = n.next;
    n.keys.resize(at);
    n.vals.resize(at);
    return {right, right.keys[0]};
  }
  std::string sep = n.keys[at];
  Node right;
  right.keys.assign(n.keys.begin() + at + 1, n.keys.end());
  right.children.assign(n.children.begin() + at + 1, n.children.end());
  n.keys.resize(at);
  n.children.resize(at + 1);
  return {right, sep};
}

void Tree::Insert(std::string_view key, std::string_view val) {
  CheckEntry(key, val);
  PageNo root = io_->Root();
  if (root == 0) {
    Node leaf;
    leaf.leaf = true;
    leaf.keys.emplace_back(key);
    leaf.vals.emplace_back(val);
    io_->SetRoot(NewPage(leaf));
    return;
  }
  auto up = InsertRec(root, key, val);
  if (!up) return;
  Node new_root;
  new_root.keys.push_back(up->sep);
  new_root.children = {root, up->right};
  io_->SetRoot(NewPage(new_root));
}

std::optional<Promoted> Tree::InsertRec(PageNo no, std::string_view key, std::string_view val) {
  Node n = Load(no);
  if (n.leaf) {
    LeafPut(n, key, val);
  } else {
    int i = ChildIndex(n, key);
    auto up = InsertRec(n.children[i], key, val);
    if (!up) return std::nullopt;
    n.InsertChild(i, up->sep, up->right);
  }
  if (n.Fits()) {
    Store(no, n);
    return std::nullopt;
  }
  auto [right, sep] = Split(n);
  PageNo right_no = io_->Allocate();
  if (n.leaf) n.next = right_no;
  Store(right_no, right);
  Store(no, n);
  return Promoted{sep, right_no};
}

}  // namespace btreekv
