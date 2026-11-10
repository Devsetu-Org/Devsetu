#include "execute/row.h"
#include <algorithm>
#include <stdexcept>

namespace sqlq {
namespace execute {

static int CompareVal(const catalog::Value& a, const catalog::Value& b) {
  if (a.t == catalog::Type::kInt) {
    if (a.i < b.i) return -1;
    if (a.i > b.i) return 1;
  } else if (a.t == catalog::Type::kText) {
    if (a.s < b.s) return -1;
    if (a.s > b.s) return 1;
  }
  return 0;
}

void SortRows(std::vector<Row>& rows, const std::vector<parse::OrderKey>& keys) {
  std::vector<int> idx(keys.size(), -1);
  std::vector<bool> desc(keys.size(), false);
  for (size_t i = 0; i < keys.size(); ++i) {
    std::string name = parse::Name(keys[i].expr.get());
    if (auto* id = dynamic_cast<const parse::Ident*>(keys[i].expr.get())) name = id->name;
    int found = -1;
    if (!rows.empty()) {
      for (size_t c = 0; c < rows[0].cols.size(); ++c) {
        if (rows[0].cols[c] == name || rows[0].cols[c] == parse::Name(keys[i].expr.get())) {
          found = static_cast<int>(c);
          break;
        }
      }
    }
    if (found < 0 && !rows.empty())
      throw std::runtime_error("ORDER BY " + name + " is not an output column");
    idx[i] = found;
    desc[i] = keys[i].desc;
  }
  std::stable_sort(rows.begin(), rows.end(), [&](const Row& a, const Row& b) {
    for (size_t i = 0; i < idx.size(); ++i) {
      if (idx[i] < 0) continue;
      int cmp = CompareVal(a.vals[idx[i]], b.vals[idx[i]]);
      if (cmp == 0) continue;
      return desc[i] ? cmp > 0 : cmp < 0;
    }
    return false;
  });
}

std::vector<Row> LimitRows(std::vector<Row> rows, int n) {
  if (n < 0 || n >= static_cast<int>(rows.size())) return rows;
  rows.resize(n);
  return rows;
}

}  // namespace execute
}  // namespace sqlq
