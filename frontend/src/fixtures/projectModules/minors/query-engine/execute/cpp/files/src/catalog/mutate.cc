#include "catalog/catalog.h"
#include <stdexcept>
#include <unordered_set>

namespace sqlq {
namespace catalog {

void DB::Create(const std::string& name, const std::vector<Col>& cols) {
  if (name.empty()) throw std::runtime_error("empty table name");
  if (cols.empty()) throw std::runtime_error("table " + name + " has no columns");
  if (tables.count(name)) throw std::runtime_error("table " + name + " already exists");
  std::unordered_set<std::string> seen;
  for (const auto& c : cols) {
    if (c.name.empty() || !seen.insert(c.name).second)
      throw std::runtime_error("bad column \"" + c.name + "\"");
  }
  Table t;
  t.name = name;
  t.cols = cols;
  tables.emplace(name, std::move(t));
}

void DB::Insert(const std::string& name, const std::vector<Value>& row) {
  Table* t = Lookup(name);
  if (row.size() != t->cols.size())
    throw std::runtime_error("table " + name + " wants " + std::to_string(t->cols.size()) + " values");
  for (size_t i = 0; i < t->cols.size(); ++i) {
    if (row[i].t != t->cols[i].type) {
      std::string want = t->cols[i].type == Type::kText ? "TEXT" : "INT";
      throw std::runtime_error("column " + t->cols[i].name + " wants " + want);
    }
  }
  t->rows.push_back(row);
}

}  // namespace catalog
}  // namespace sqlq
