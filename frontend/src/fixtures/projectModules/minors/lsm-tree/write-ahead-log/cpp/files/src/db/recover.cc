#include "db/db.h"

#include <stdexcept>

namespace lsmkv {
namespace db {

void DB::RecoverLog() {
  // TODO(2.4): replay the log at dir_ + "/" + kWalName, applying every
  // record to mem_ with Apply. Then set log_ with wal::OpenAppend at the
  // good offset Replay returned (and opts_.sync), so a torn tail is cut
  // off before anything new is appended.
  throw std::logic_error("TODO(2.4): RecoverLog");
}

void DB::Commit(const wal::Record& r) {
  // TODO(2.4): append r to log_ first. Only if that succeeds, Apply it to
  // mem_. A write that failed to reach the log must not become visible.
  (void)r;
  throw std::logic_error("TODO(2.4): Commit");
}

}  // namespace db
}  // namespace lsmkv
