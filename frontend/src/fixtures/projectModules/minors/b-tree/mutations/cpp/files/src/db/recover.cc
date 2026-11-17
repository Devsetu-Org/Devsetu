#include "db/recover.h"

#include "db/apply.h"
#include "db/db.h"
#include "wal/reader.h"
#include "wal/writer.h"

#include <stdexcept>
#include <vector>

namespace btreekv {

void RecoverLog(DB* d) {
  std::string path = d->dir() + "/wal.log";
  std::vector<Record> pending;
  int64_t committed = 0;
  Replay(path, [&](const Record& r, int64_t end) {
    pending.push_back(r);
    if (r.kind != WalKind::kCommit) return;
    ApplyRecords(d, pending);
    pending.clear();
    committed = end;
  });
  d->set_log(OpenAppend(path, committed, d->opts().sync));
}

void Commit(DB* d, Txn* t) {
  std::vector<Record> recs = t->Records();
  int64_t start = d->log()->Size();
  try {
    d->log()->Append(recs);
  } catch (...) {
    d->log()->Rewind(start);
    throw;
  }
  ApplyRecords(d, recs);
}

}  // namespace btreekv
