#include "parse/parser.h"

namespace sqlq {
namespace parse {

std::unique_ptr<Expr> ParseExpr(Parser& p) { return ParseAnd(p); }

std::unique_ptr<Expr> ParseAnd(Parser& p) {
  // TODO(2.1) — ParseAnd
  throw p.Errorf("TODO(2.1)");
}

std::unique_ptr<Expr> ParseCmp(Parser& p) {
  // TODO(2.1) — ParseCmp
  throw p.Errorf("TODO(2.1)");
}

std::unique_ptr<Expr> ParsePrimary(Parser& p) {
  // TODO(2.2) — ParsePrimary
  throw p.Errorf("TODO(2.2)");
}

std::unique_ptr<Expr> ParseCall(Parser& p, const std::string& name, bool allow_star) {
  // TODO(2.2) — ParseCall
  throw p.Errorf("TODO(2.2)");
}

}  // namespace parse
}  // namespace sqlq
