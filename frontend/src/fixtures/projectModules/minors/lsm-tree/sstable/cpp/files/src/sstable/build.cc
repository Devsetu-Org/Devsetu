#include "sstable/writer.h"
#include <stdexcept>
namespace lsmkv { namespace sstable {
void Writer::add(Kind kind, std::string_view key, std::string_view value) {
  // TODO(3.1)
  (void)kind; (void)key; (void)value;
  throw std::logic_error("TODO(3.1)");
}
void Writer::flushBlock() {
  // TODO(3.1)
  throw std::logic_error("TODO(3.1)");
}
void Writer::finish(Handle filter) {
  // TODO(3.2)
  (void)filter;
  throw std::logic_error("TODO(3.2)");
}
}}  // namespace
