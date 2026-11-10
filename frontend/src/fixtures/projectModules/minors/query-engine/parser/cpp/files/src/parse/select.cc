#include "parse/parser.h"

namespace sqlq {
namespace parse {

std::unique_ptr<Select> ParseSelect(Parser& p) {
  // TODO(2.3): SELECT, items, FROM, table, ParseAlias, ParseFromTail, optional WHERE, FinishSelect.
  throw p.Errorf("TODO(2.3): ParseSelect");
}

SelectItem ParseSelectItem(Parser& p) {
  // TODO(2.3): '*' is star. Otherwise an expression, then an optional AS name.
  throw p.Errorf("TODO(2.3): ParseSelectItem");
}

std::string ParseAlias(Parser& p) {
  // TODO(2.3): AS ident, or a bare ident, or "".
  throw p.Errorf("TODO(2.3): ParseAlias");
}

}  // namespace parse
}  // namespace sqlq
