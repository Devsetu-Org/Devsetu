#include "execute/row.h"
#include <stdexcept>

namespace sqlq {
namespace execute {

std::vector<Row> Aggregate(const std::vector<Row>& rows,
                           const std::vector<parse::SelectItem>& items,
                           const std::vector<std::unique_ptr<parse::Expr>>& group) {
  // TODO(5.3): Bucket rows by GROUP BY. COUNT(*) is bucket size. SUM adds Eval.
  throw std::runtime_error("TODO(5.3): Aggregate");
}

}  // namespace execute
}  // namespace sqlq
