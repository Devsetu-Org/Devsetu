#include "db/recover.h"

#include "db/apply.h"
#include "db/db.h"
#include "wal/reader.h"
#include "wal/writer.h"

#include <stdexcept>
#include <vector>

namespace btreekv {

void RecoverLog(DB* d) {
  // TODO(3.4)
  (void)d;
  throw std::logic_error("TODO(3.4)");
}

void Commit(DB* d, Txn* t) {
  // TODO(3.4)
  (void)d;
  (void)t;
  throw std::logic_error("TODO(3.4)");
}

}  // namespace btreekv
