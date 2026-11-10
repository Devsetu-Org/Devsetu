#include "execute/row.h"

namespace sqlq {
namespace execute {

std::pair<Row, bool> Project::Next() {
  // TODO(4.4): Pull one child row. Call pick.
  throw std::runtime_error("TODO(4.4): Project::Next");
}

}  // namespace execute
}  // namespace sqlq
