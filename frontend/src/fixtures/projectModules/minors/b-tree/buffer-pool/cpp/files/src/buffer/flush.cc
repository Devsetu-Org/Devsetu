#include "buffer/pool.h"

#include <stdexcept>

namespace btreekv {

void Pool::FlushFrame(Frame* f) {
  // TODO(4.3): If not dirty, return. If log and f->lsn > log->Durable(), Sync.
  // WritePage to backing, clear dirty.
  (void)f;
  throw std::logic_error("TODO(4.3): FlushFrame");
}

}  // namespace btreekv
