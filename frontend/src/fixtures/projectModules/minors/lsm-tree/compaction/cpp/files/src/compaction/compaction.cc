#include "compaction/compaction.h"
#include <stdexcept>
namespace lsmkv { namespace compaction {
Stats Merge(std::vector<it::Cursor>, sstable::Writer*, bool) {
  throw std::logic_error("TODO(5.1): Merge");
}
}} 
