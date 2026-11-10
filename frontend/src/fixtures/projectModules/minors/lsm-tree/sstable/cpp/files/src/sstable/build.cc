#include "sstable/writer.h"
#include <stdexcept>
namespace lsmkv { namespace sstable {
void Writer::add(Kind kind, std::string_view key, std::string_view value) {
  // TODO(3.1): reject out-of-order keys; append_entry; cut at BlockSize.
  (void)kind; (void)key; (void)value;
  throw std::logic_error("TODO(3.1): add");
}
void Writer::flushBlock() {
  // TODO(3.1): write block + index entry, clear block.
  throw std::logic_error("TODO(3.1): flushBlock");
}
void Writer::finish(Handle filter) {
  // TODO(3.2): write index block + footer; flush, fsync, close.
  (void)filter;
  throw std::logic_error("TODO(3.2): finish");
}
}}  // namespace
