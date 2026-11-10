#include "parse/parser.h"

namespace sqlq {
namespace parse {

void ParseTail(Parser& p, Select* s) {
  if (p.At(lex::Kind::kKwGroup) || p.At(lex::Kind::kKwOrder) || p.At(lex::Kind::kKwLimit)) {
    // TODO(5.1): GROUP BY, ORDER BY, LIMIT.
    throw p.Errorf("TODO(5.1): ParseTail");
  }
}

std::unique_ptr<Join> ParseJoin(Parser& p) {
  // TODO(5.1): Optional INNER, then JOIN, table, ParseAlias, ON, primary, '=', primary.
  throw p.Errorf("TODO(5.1): ParseJoin");
}

}  // namespace parse
}  // namespace sqlq
