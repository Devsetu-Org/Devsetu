#include "db/db.h"
#include <stdexcept>
namespace lsmkv { namespace db {
void DB::flush() {
  if (mem_.Len() == 0) return;
  uint64_t num = next_file_++;
  std::string path = TablePath(dir_, num);
  std::string tmp = path + kTmpExt;
  // TODO(3.4)
  (void)tmp;
  throw std::logic_error("TODO(3.4)");
}
}} 
