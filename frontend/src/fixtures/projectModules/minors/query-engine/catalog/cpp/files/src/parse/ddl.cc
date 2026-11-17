#include "parse/parser.h"

namespace sqlq {
namespace parse {

std::unique_ptr<CreateTable> ParseCreate(Parser& p) {
  // TODO(3.1) — ParseCreate
  throw p.Errorf("TODO(3.1)");
}

TypeName ParseType(Parser& p) {
  // TODO(3.1) — ParseType
  throw p.Errorf("TODO(3.1)");
}

std::unique_ptr<Insert> ParseInsert(Parser& p) {
  // TODO(3.1) — ParseInsert
  throw p.Errorf("TODO(3.1)");
}

}  // namespace parse
}  // namespace sqlq
