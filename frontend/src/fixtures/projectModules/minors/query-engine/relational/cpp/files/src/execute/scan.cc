#include "execute/row.h"

namespace sqlq {
namespace execute {

std::pair<Row, bool> Scan::Next() {
  if (i >= rows.size()) return {Row{}, false};
  Row r;
  r.cols = cols;
  r.vals = rows[i];
  ++i;
  return {std::move(r), true};
}

}  // namespace execute
}  // namespace sqlq
