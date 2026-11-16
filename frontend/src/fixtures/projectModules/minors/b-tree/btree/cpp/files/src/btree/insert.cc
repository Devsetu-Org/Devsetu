#include "btree/tree.h"

#include <stdexcept>

namespace btreekv {

void LeafPut(Node& n, std::string_view key, std::string_view val) {
  // TODO(2.3)
  (void)n; (void)key; (void)val;
  throw std::logic_error("TODO(2.3)");
}

std::pair<Node, std::string> Split(Node& n) {
  // TODO(2.4)
  (void)n;
  throw std::logic_error("TODO(2.4)");
}

void Tree::Insert(std::string_view key, std::string_view val) {
  // TODO(2.5)
  (void)key; (void)val;
  throw std::logic_error("TODO(2.5)");
}

std::optional<Promoted> Tree::InsertRec(PageNo no, std::string_view key, std::string_view val) {
  // TODO(2.5)
  (void)no; (void)key; (void)val;
  throw std::logic_error("TODO(2.5)");
}

}  // namespace btreekv
