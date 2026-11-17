#include "catalog/catalog.h"
#include <stdexcept>

namespace sqlq {
namespace catalog {

void DB::Create(const std::string& name, const std::vector<Col>& cols) {
  // TODO(3.2) — Create
  throw std::runtime_error("TODO(3.2)");
}

void DB::Insert(const std::string& name, const std::vector<Value>& row) {
  // TODO(3.3) — Insert
  throw std::runtime_error("TODO(3.3)");
}

}  // namespace catalog
}  // namespace sqlq
