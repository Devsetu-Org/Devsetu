#include "execute/row.h"
#include <stdexcept>

namespace sqlq {
namespace execute {

std::vector<Row> Aggregate(const std::vector<Row>& rows,
                           const std::vector<parse::SelectItem>& items,
                           const std::vector<std::unique_ptr<parse::Expr>>& group) {
  // TODO(5.3) — Aggregate
  throw std::runtime_error("TODO(5.3)");
}

}  // namespace execute
}  // namespace sqlq
