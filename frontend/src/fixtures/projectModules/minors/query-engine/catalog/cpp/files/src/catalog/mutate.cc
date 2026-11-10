#include "catalog/catalog.h"
#include <stdexcept>

namespace sqlq {
namespace catalog {

void DB::Create(const std::string& name, const std::vector<Col>& cols) {
  // TODO(3.2): Reject an empty name, an empty column list, a duplicate table, or a duplicate column.
  // Store a copy of cols on a new Table.
  throw std::runtime_error("TODO(3.2): Create");
}

void DB::Insert(const std::string& name, const std::vector<Value>& row) {
  // TODO(3.3): Lookup the table. Reject a width mismatch or a cell whose T is not the column's Type.
  throw std::runtime_error("TODO(3.3): Insert");
}

}  // namespace catalog
}  // namespace sqlq
