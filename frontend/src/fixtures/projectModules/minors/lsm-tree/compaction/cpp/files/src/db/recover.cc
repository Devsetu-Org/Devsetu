#include "db/db.h"

#include "wal/reader.h"

namespace lsmkv {
namespace db {

void DB::RecoverLog() {
  const std::string path = dir_ + "/" + kWalName;
  int64_t good = wal::Replay(path, [this](const wal::Record& r) { Apply(&mem_, r); });
  log_.reset(wal::OpenAppend(path, good, opts_.sync));
}

void DB::Commit(const wal::Record& r) {
  log_->Append(r);
  Apply(&mem_, r);
}

}  // namespace db
}  // namespace lsmkv
