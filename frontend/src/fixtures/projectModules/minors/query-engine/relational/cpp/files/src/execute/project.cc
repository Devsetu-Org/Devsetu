#include "execute/row.h"

namespace sqlq {
namespace execute {

std::pair<Row, bool> Project::Next() {
  auto [row, ok] = child->Next();
  if (!ok) return {Row{}, false};
  return {pick(row), true};
}

}  // namespace execute
}  // namespace sqlq
