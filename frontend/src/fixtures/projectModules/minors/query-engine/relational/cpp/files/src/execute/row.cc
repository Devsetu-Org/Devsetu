#include "execute/row.h"

namespace sqlq {
namespace execute {

std::pair<catalog::Value, bool> Row::Get(const std::string& name) const {
  for (size_t i = 0; i < cols.size(); ++i) {
    if (cols[i] == name) return {vals[i], true};
  }
  int found = -1;
  for (size_t i = 0; i < cols.size(); ++i) {
    auto dot = cols[i].rfind('.');
    if (dot != std::string::npos && cols[i].substr(dot + 1) == name) {
      if (found >= 0) return {catalog::Value{}, false};
      found = static_cast<int>(i);
    }
  }
  if (found < 0) return {catalog::Value{}, false};
  return {vals[found], true};
}

std::vector<Row> ReadAll(Iter& it) {
  std::vector<Row> out;
  for (;;) {
    auto [row, ok] = it.Next();
    if (!ok) return out;
    out.push_back(std::move(row));
  }
}

std::unique_ptr<Scan> NewScan(const catalog::Table& t, const std::string& qualifier) {
  auto s = std::make_unique<Scan>();
  for (const auto& c : t.cols) s->cols.push_back(qualifier + "." + c.name);
  s->rows = t.rows;
  return s;
}

}  // namespace execute
}  // namespace sqlq
