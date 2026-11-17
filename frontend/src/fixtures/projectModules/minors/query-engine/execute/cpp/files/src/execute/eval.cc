#include "execute/row.h"
#include <stdexcept>

namespace sqlq {
namespace execute {

catalog::Value Eval(const parse::Expr* e, const Row& row) {
  // TODO(4.2) — Eval
  throw std::runtime_error("TODO(4.2)");
}

bool Truth(const parse::Expr* e, const Row& row) {
  auto v = Eval(e, row);
  if (v.t != catalog::Type::kBool) throw std::runtime_error("WHERE must be a comparison");
  return v.b;
}

}  // namespace execute
}  // namespace sqlq
