#include "execute/row.h"
#include <stdexcept>

namespace sqlq {
namespace execute {

void SortRows(std::vector<Row>& rows, const std::vector<parse::OrderKey>& keys) {
  // TODO(5.4) — SortRows
  throw std::runtime_error("TODO(5.4)");
}

std::vector<Row> LimitRows(std::vector<Row> rows, int n) {
  if (n < 0 || n >= static_cast<int>(rows.size())) return rows;
  rows.resize(n);
  return rows;
}

}  // namespace execute
}  // namespace sqlq
