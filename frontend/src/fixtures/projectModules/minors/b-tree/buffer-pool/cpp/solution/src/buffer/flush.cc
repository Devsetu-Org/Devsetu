#include "buffer/pool.h"

namespace btreekv {

void Pool::FlushFrame(Frame* f) {
  if (!f->dirty) return;
  if (log_ != nullptr && f->lsn > log_->Durable()) {
    log_->Sync();
  }
  b_->WritePage(f->no, f->data.data(), f->data.size());
  f->dirty = false;
}

}  // namespace btreekv
