#include "sstable/reader.h"
#include <stdexcept>
namespace lsmkv { namespace sstable {
std::unique_ptr<Table> OpenFile(FILE* f, Handle* filter_out) {
  // TODO(3.3): read footer, decode, load index.
  (void)f; (void)filter_out;
  throw std::logic_error("TODO(3.3): open");
}
Result Table::get(std::string_view key, std::string* value) {
  // TODO(3.3): binary search index; read one block; scan entries.
  (void)key; (void)value;
  throw std::logic_error("TODO(3.3): get");
}
}} 
