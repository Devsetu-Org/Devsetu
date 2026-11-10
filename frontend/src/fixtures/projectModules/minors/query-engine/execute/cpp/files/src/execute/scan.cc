#include "execute/row.h"

namespace sqlq {
namespace execute {

std::pair<Row, bool> Scan::Next() {
  // TODO(4.1): When i is past rows, return {Row{}, false}.
  // Otherwise copy the next row's values and the column names, bump i, and return them.
  throw std::runtime_error("TODO(4.1): Scan::Next");
}

}  // namespace execute
}  // namespace sqlq
