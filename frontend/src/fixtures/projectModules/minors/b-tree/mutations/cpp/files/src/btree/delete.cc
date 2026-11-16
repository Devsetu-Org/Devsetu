#include "btree/tree.h"

#include <stdexcept>

namespace btreekv {

std::pair<bool, bool> Tree::DeleteRec(PageNo no, std::string_view key) {
  // TODO(5.1)
  (void)no;
  (void)key;
  throw std::logic_error("TODO(5.1)");
}

void Tree::Rebalance(PageNo parent_no, Node& parent, int i) {
  // TODO(5.2)
  (void)parent_no;
  (void)parent;
  (void)i;
  throw std::logic_error("TODO(5.2)");
}

bool Tree::Delete(std::string_view key) {
  // TODO(5.3)
  (void)key;
  throw std::logic_error("TODO(5.3)");
}

}  // namespace btreekv
