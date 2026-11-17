#include "parse/parser.h"

namespace sqlq {
namespace parse {

void ParseTail(Parser& p, Select* s) {
  if (p.Eat(lex::Kind::kKwGroup)) {
    p.Expect(lex::Kind::kKwBy);
    for (;;) {
      s->group.push_back(ParseExpr(p));
      if (!p.Eat(lex::Kind::kComma)) break;
    }
  }
  if (p.Eat(lex::Kind::kKwOrder)) {
    p.Expect(lex::Kind::kKwBy);
    for (;;) {
      OrderKey key;
      key.expr = ParseExpr(p);
      if (p.Eat(lex::Kind::kKwDesc)) key.desc = true;
      else p.Eat(lex::Kind::kKwAsc);
      s->order.push_back(std::move(key));
      if (!p.Eat(lex::Kind::kComma)) break;
    }
  }
  if (p.Eat(lex::Kind::kKwLimit)) {
    auto t = p.Expect(lex::Kind::kInt);
    try {
      s->limit = ParseInt(t.lit);
      s->has_limit = true;
    } catch (...) {
      throw p.Errorf("bad limit");
    }
  }
}

std::unique_ptr<Join> ParseJoin(Parser& p) {
  p.Eat(lex::Kind::kKwInner);
  p.Expect(lex::Kind::kKwJoin);
  auto name = p.Expect(lex::Kind::kIdent);
  auto j = std::make_unique<Join>();
  j->table = name.lit;
  j->alias = ParseAlias(p);
  p.Expect(lex::Kind::kKwOn);
  j->left = ParsePrimary(p);
  p.Expect(lex::Kind::kEq);
  j->right = ParsePrimary(p);
  return j;
}

}  // namespace parse
}  // namespace sqlq
