#include "parse/parser.h"

namespace sqlq {
namespace parse {

void ParseTail(Parser& p, Select* s) {
  if (p.At(lex::Kind::kKwGroup) || p.At(lex::Kind::kKwOrder) || p.At(lex::Kind::kKwLimit)) {
    // TODO(5.1) — ParseTail
    throw p.Errorf("TODO(5.1)");
  }
}

std::unique_ptr<Join> ParseJoin(Parser& p) {
  // TODO(5.1) — ParseJoin
  throw p.Errorf("TODO(5.1)");
}

}  // namespace parse
}  // namespace sqlq
