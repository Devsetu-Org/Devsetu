#include "parse/parser.h"

namespace sqlq {
namespace parse {

std::unique_ptr<CreateTable> ParseCreate(Parser& p) {
  // TODO(3.1): CREATE TABLE ident '(' col type {',' col type} ')'.
  throw p.Errorf("TODO(3.1): ParseCreate");
}

TypeName ParseType(Parser& p) {
  // TODO(3.1): kKwInt -> kInt, kKwText -> kText, else an error.
  throw p.Errorf("TODO(3.1): ParseType");
}

std::unique_ptr<Insert> ParseInsert(Parser& p) {
  // TODO(3.1): INSERT INTO ident VALUES, then parenthesized lists of primaries.
  throw p.Errorf("TODO(3.1): ParseInsert");
}

}  // namespace parse
}  // namespace sqlq
