#include "parse/parser.h"

namespace sqlq {
namespace parse {

std::unique_ptr<CreateTable> ParseCreate(Parser& p) {
  p.Expect(lex::Kind::kKwCreate);
  p.Expect(lex::Kind::kKwTable);
  auto name = p.Expect(lex::Kind::kIdent);
  p.Expect(lex::Kind::kLParen);
  auto ct = std::make_unique<CreateTable>();
  ct->name = name.lit;
  for (;;) {
    auto col = p.Expect(lex::Kind::kIdent);
    auto typ = ParseType(p);
    ct->cols.push_back(Column{col.lit, typ});
    if (p.Eat(lex::Kind::kComma)) continue;
    break;
  }
  p.Expect(lex::Kind::kRParen);
  return ct;
}

TypeName ParseType(Parser& p) {
  if (p.Eat(lex::Kind::kKwInt)) return TypeName::kInt;
  if (p.Eat(lex::Kind::kKwText)) return TypeName::kText;
  throw p.Errorf("expected INT or TEXT");
}

std::unique_ptr<Insert> ParseInsert(Parser& p) {
  p.Expect(lex::Kind::kKwInsert);
  p.Expect(lex::Kind::kKwInto);
  auto name = p.Expect(lex::Kind::kIdent);
  p.Expect(lex::Kind::kKwValues);
  auto ins = std::make_unique<Insert>();
  ins->table = name.lit;
  for (;;) {
    p.Expect(lex::Kind::kLParen);
    std::vector<std::unique_ptr<Expr>> row;
    for (;;) {
      row.push_back(ParsePrimary(p));
      if (p.Eat(lex::Kind::kComma)) continue;
      break;
    }
    p.Expect(lex::Kind::kRParen);
    ins->rows.push_back(std::move(row));
    if (p.Eat(lex::Kind::kComma)) continue;
    break;
  }
  return ins;
}

}  // namespace parse
}  // namespace sqlq
