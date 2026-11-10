#include "parse/parser.h"

namespace sqlq {
namespace parse {

std::unique_ptr<Expr> ParseExpr(Parser& p) { return ParseAnd(p); }

std::unique_ptr<Expr> ParseAnd(Parser& p) {
  // TODO(2.1): ParseCmp, then while the next token is AND, parse another comparison
  // and wrap the two in Binary{"AND", left, right}.
  throw p.Errorf("TODO(2.1): ParseAnd");
}

std::unique_ptr<Expr> ParseCmp(Parser& p) {
  // TODO(2.1): ParsePrimary. If the next token is =, <, or >, consume it, parse another
  // primary, and return Binary. Otherwise return the primary.
  throw p.Errorf("TODO(2.1): ParseCmp");
}

std::unique_ptr<Expr> ParsePrimary(Parser& p) {
  // TODO(2.2): Int -> IntLit. String -> StrLit. COUNT/SUM -> ParseCall.
  // Ident, then optional . Ident. '(' expr ')'.
  throw p.Errorf("TODO(2.2): ParsePrimary");
}

std::unique_ptr<Expr> ParseCall(Parser& p, const std::string& name, bool allow_star) {
  // TODO(2.2): Consume the keyword, '(', then either '*' (only when allow_star) or an expression, then ')'.
  throw p.Errorf("TODO(2.2): ParseCall");
}

}  // namespace parse
}  // namespace sqlq
