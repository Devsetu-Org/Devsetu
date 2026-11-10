#include "btree/tree.h"

#include <stdexcept>
#include <unordered_map>
#include <vector>

namespace btreekv {

namespace {

struct Checker {
  Tree* t;
  std::unordered_map<PageNo, bool> seen;
  std::vector<PageNo> leaves;
  std::vector<PageNo> nexts;
  int internal = 0;
  int keys = 0;

  int Walk(PageNo no, const std::string* lo, const std::string* hi, bool is_root, int depth) {
    if (depth > kMaxDepth) throw std::runtime_error("btree check: too deep");
    if (no == 0) throw std::runtime_error("btree check: pointer to page 0");
    if (seen.count(no)) throw std::runtime_error("btree check: page reachable twice");
    seen[no] = true;
    Node n = t->Load(no);
    if (n.keys.empty() && !(is_root && n.leaf)) throw std::runtime_error("btree check: empty page");
    for (size_t i = 0; i < n.keys.size(); ++i) {
      if (i > 0 && n.keys[i - 1] >= n.keys[i]) throw std::runtime_error("btree check: keys out of order");
      if (lo && n.keys[i] < *lo) throw std::runtime_error("btree check: below lower bound");
      if (hi && n.keys[i] >= *hi) throw std::runtime_error("btree check: not below upper bound");
    }
    if (n.leaf) {
      leaves.push_back(no);
      nexts.push_back(n.next);
      keys += int(n.keys.size());
      return 1;
    }
    ++internal;
    int height = 0;
    for (size_t i = 0; i < n.children.size(); ++i) {
      const std::string* clo = lo;
      const std::string* chi = hi;
      std::string clo_s, chi_s;
      if (i > 0) {
        clo_s = n.keys[i - 1];
        clo = &clo_s;
      }
      if (i < n.keys.size()) {
        chi_s = n.keys[i];
        chi = &chi_s;
      }
      int h = Walk(n.children[i], clo, chi, false, depth + 1);
      if (i == 0) height = h;
      else if (h != height) throw std::runtime_error("btree check: uneven heights");
    }
    return height + 1;
  }
};

}  // namespace

TreeStats Tree::Check() {
  TreeStats st;
  PageNo root = io_->Root();
  if (root == 0) return st;
  Checker c; c.t = this;
  int h = c.Walk(root, nullptr, nullptr, true, 0);
  for (size_t i = 0; i < c.leaves.size(); ++i) {
    PageNo want = 0;
    if (i + 1 < c.leaves.size()) want = c.leaves[i + 1];
    if (c.nexts[i] != want) throw std::runtime_error("btree check: bad leaf link");
  }
  st.height = h;
  st.leaves = int(c.leaves.size());
  st.internal = c.internal;
  st.keys = c.keys;
  return st;
}

}  // namespace btreekv
