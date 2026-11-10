#include "parse/parser.h"

namespace sqlq {
namespace parse {

std::unique_ptr<Expr> ParseExpr(Parser& p) { return ParseAnd(p); }

std::unique_ptr<Expr> ParseAnd(Parser& p) {
  auto left = ParseCmp(p);
  while (p.Eat(lex::Kind::kKwAnd)) {
    auto right = ParseCmp(p);
    left = std::make_unique<Binary>("AND", std::move(left), std::move(right));
  }
  return left;
}

std::unique_ptr<Expr> ParseCmp(Parser& p) {
  auto left = ParsePrimary(p);
  std::string op;
  if (p.Eat(lex::Kind::kEq)) op = "=";
  else if (p.Eat(lex::Kind::kLt)) op = "<";
  else if (p.Eat(lex::Kind::kGt)) op = ">";
  else return left;
  auto right = ParsePrimary(p);
  return std::make_unique<Binary>(op, std::move(left), std::move(right));
}

std::unique_ptr<Expr> ParsePrimary(Parser& p) {
  if (p.At(lex::Kind::kInt)) {
    auto t = p.Expect(lex::Kind::kInt);
    try { return std::make_unique<IntLit>(ParseInt(t.lit)); }
    catch (...) { throw p.Errorf("bad integer"); }
  }
  if (p.At(lex::Kind::kString)) {
    auto t = p.Expect(lex::Kind::kString);
    return std::make_unique<StrLit>(t.lit);
  }
  if (p.At(lex::Kind::kKwCount)) return ParseCall(p, "count", true);
  if (p.At(lex::Kind::kKwSum)) return ParseCall(p, "sum", false);
  if (p.At(lex::Kind::kIdent)) {
    auto t = p.Expect(lex::Kind::kIdent);
    if (p.Eat(lex::Kind::kDot)) {
      auto col = p.Expect(lex::Kind::kIdent);
      return std::make_unique<Qual>(t.lit, col.lit);
    }
    return std::make_unique<Ident>(t.lit);
  }
  if (p.Eat(lex::Kind::kLParen)) {
    auto e = ParseExpr(p);
    p.Expect(lex::Kind::kRParen);
    return e;
  }
  throw p.Errorf("expected an expression");
}

std::unique_ptr<Expr> ParseCall(Parser& p, const std::string& name, bool allow_star) {
  if (name == "count") p.Eat(lex::Kind::kKwCount);
  else p.Eat(lex::Kind::kKwSum);
  p.Expect(lex::Kind::kLParen);
  auto call = std::make_unique<Call>();
  call->name = name;
  if (allow_star && p.Eat(lex::Kind::kStar)) {
    p.Expect(lex::Kind::kRParen);
    call->star = true;
    return call;
  }
  call->arg = ParseExpr(p);
  p.Expect(lex::Kind::kRParen);
  return call;
}

}  // namespace parse
}  // namespace sqlq
