#include "buffer/pool.h"

#include <stdexcept>

namespace btreekv {

Frame* Pool::Pin(PageNo no, bool load) {
  std::lock_guard<std::mutex> lock(mu_);
  auto it = table_.find(no);
  if (it != table_.end()) {
    Frame* f = &frames_[it->second];
    f->pins++;
    f->ref = true;
    return f;
  }
  int i = Victim();
  Frame* f = &frames_[size_t(i)];
  if (f->used) {
    FlushFrame(f);
    table_.erase(f->no);
    f->used = false;
  }
  if (load) {
    b_->ReadPage(no, f->data.data(), f->data.size());
  }
  f->no = no;
  f->used = true;
  f->ref = true;
  f->pins = 1;
  f->dirty = false;
  f->lsn = 0;
  table_[no] = i;
  return f;
}

void Pool::Unpin(Frame* f, bool dirty) {
  std::lock_guard<std::mutex> lock(mu_);
  if (f->pins == 0) throw std::runtime_error("buffer: Unpin of a frame that is not pinned");
  f->pins--;
  if (dirty) {
    f->dirty = true;
    f->lsn = LogSize();
  }
}

}  // namespace btreekv
