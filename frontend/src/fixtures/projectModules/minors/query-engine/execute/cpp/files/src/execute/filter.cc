#include "execute/row.h"

namespace sqlq {
namespace execute {

std::pair<Row, bool> Filter::Next() {
  // TODO(4.3): Pull from child until pred returns true. Pass through a false ok.
  throw std::runtime_error("TODO(4.3): Filter::Next");
}

}  // namespace execute
}  // namespace sqlq
