#include "catalog/catalog.h"
#include <stdexcept>

namespace sqlq {
namespace catalog {

std::string Value::String() const {
  if (t == Type::kInt) return std::to_string(i);
  if (t == Type::kText) return s;
  return b ? "true" : "false";
}

Table* DB::Lookup(const std::string& name) {
  auto it = tables.find(name);
  if (it == tables.end()) throw std::runtime_error("no such table " + name);
  return &it->second;
}

}  // namespace catalog
}  // namespace sqlq
