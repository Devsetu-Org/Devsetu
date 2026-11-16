#include "sstable/reader.h"
#include <stdexcept>
namespace lsmkv { namespace sstable {
std::unique_ptr<Table> OpenFile(FILE* f, Handle* filter_out) {
  // TODO(3.3)
  (void)f; (void)filter_out;
  throw std::logic_error("TODO(3.3)");
}
Result Table::get(std::string_view key, std::string* value) {
  // TODO(3.3)
  (void)key; (void)value;
  throw std::logic_error("TODO(3.3)");
}
}} 
