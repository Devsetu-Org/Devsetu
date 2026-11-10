#include "db/recover.h"

#include "db/apply.h"
#include "db/db.h"
#include "wal/reader.h"
#include "wal/writer.h"

#include <stdexcept>
#include <vector>

namespace btreekv {

void RecoverLog(DB* d) {
  // TODO(3.4): path = d->dir() + "/wal.log". Replay with a callback that
  // collects records into pending. On WalKind::kCommit, ApplyRecords(d, pending),
  // clear pending, remember end as last commit. Then
  // d->set_log(OpenAppend(path, committed, d->opts().sync)).
  (void)d;
  throw std::logic_error("TODO(3.4): RecoverLog");
}

void Commit(DB* d, Txn* t) {
  // TODO(3.4): recs = t->Records(); start = d->log()->Size(). Append the batch.
  // On failure, Rewind(start) and rethrow. Only then ApplyRecords(d, recs).
  (void)d;
  (void)t;
  throw std::logic_error("TODO(3.4): Commit");
}

}  // namespace btreekv
