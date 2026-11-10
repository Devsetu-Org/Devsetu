#include "execute/row.h"

namespace sqlq {
namespace execute {

std::pair<Row, bool> Filter::Next() {
  for (;;) {
    auto [row, ok] = child->Next();
    if (!ok) return {Row{}, false};
    if (pred(row)) return {std::move(row), true};
  }
}

}  // namespace execute
}  // namespace sqlq
