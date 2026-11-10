#include "execute/row.h"

namespace sqlq {
namespace execute {

static Row Concat(const Row& a, const Row& b) {
  Row out;
  out.cols = a.cols;
  out.cols.insert(out.cols.end(), b.cols.begin(), b.cols.end());
  out.vals = a.vals;
  out.vals.insert(out.vals.end(), b.vals.begin(), b.vals.end());
  return out;
}

static bool ValuesEqual(const catalog::Value& a, const catalog::Value& b) {
  if (a.t != b.t) return false;
  if (a.t == catalog::Type::kInt) return a.i == b.i;
  if (a.t == catalog::Type::kText) return a.s == b.s;
  return a.b == b.b;
}

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
  for (;;) {
    if (!primed || rj >= right.size()) {
      auto [row, ok] = left->Next();
      if (!ok) return {Row{}, false};
      cur = std::move(row);
      rj = 0;
      primed = true;
    }
    if (rj >= right.size()) continue;
    const Row& r = right[rj++];
    Row joined = Concat(cur, r);
    auto lv = Eval(on_l, joined);
    auto rv = Eval(on_r, joined);
    if (lv.t == rv.t && ValuesEqual(lv, rv)) return {std::move(joined), true};
  }
}

}  // namespace execute
}  // namespace sqlq
