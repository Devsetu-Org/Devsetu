#include "db/db.h"

#include <stdexcept>

namespace lsmkv {
namespace db {

void DB::RecoverLog() {
  // TODO(2.4)
  throw std::logic_error("TODO(2.4)");
}

void DB::Commit(const wal::Record& r) {
  // TODO(2.4)
  (void)r;
  throw std::logic_error("TODO(2.4)");
}

}  // namespace db
}  // namespace lsmkv
