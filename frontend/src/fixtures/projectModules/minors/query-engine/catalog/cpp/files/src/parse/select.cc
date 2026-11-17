#include "parse/parser.h"

namespace sqlq {
namespace parse {

std::unique_ptr<Select> ParseSelect(Parser& p) {
  p.Expect(lex::Kind::kKwSelect);
  auto sel = std::make_unique<Select>();
  for (;;) {
    sel->items.push_back(ParseSelectItem(p));
    if (!p.Eat(lex::Kind::kComma)) break;
  }
  p.Expect(lex::Kind::kKwFrom);
  auto name = p.Expect(lex::Kind::kIdent);
  sel->from = name.lit;
  sel->alias = ParseAlias(p);
  p.ParseFromTail(sel.get());
  if (p.Eat(lex::Kind::kKwWhere)) sel->where = ParseExpr(p);
  p.FinishSelect(sel.get());
  return sel;
}

SelectItem ParseSelectItem(Parser& p) {
  if (p.Eat(lex::Kind::kStar)) {
    SelectItem item;
    item.star = true;
    return item;
  }
  SelectItem item;
  item.expr = ParseExpr(p);
  if (p.Eat(lex::Kind::kKwAs)) {
    auto a = p.Expect(lex::Kind::kIdent);
    item.alias = a.lit;
  }
  return item;
}

std::string ParseAlias(Parser& p) {
  if (p.Eat(lex::Kind::kKwAs)) {
    auto a = p.Expect(lex::Kind::kIdent);
    return a.lit;
  }
  if (p.At(lex::Kind::kIdent)) {
    auto a = p.Expect(lex::Kind::kIdent);
    return a.lit;
  }
  return "";
}

}  // namespace parse
}  // namespace sqlq
