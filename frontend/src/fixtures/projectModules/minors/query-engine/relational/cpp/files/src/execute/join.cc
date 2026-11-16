#include "execute/row.h"

namespace sqlq {
namespace execute {

std::unique_ptr<NestedLoop> NewNestedLoop(std::unique_ptr<Iter> left, std::vector<Row> right,
                                          const parse::Expr* on_l, const parse::Expr* on_r) {
  auto n = std::make_unique<NestedLoop>();
  n->left = std::move(left);
  n->right = std::move(right);
  n->on_l = on_l;
  n->on_r = on_r;
  return n;
}

std::pair<Row, bool> NestedLoop::Next() {
  // TODO(5.2) — NestedLoop::Next
  throw std::runtime_error("TODO(5.2)");
}

}  // namespace execute
}  // namespace sqlq
