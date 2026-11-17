#include "buffer/pool.h"

#include <algorithm>
#include <cstring>

namespace btreekv {

Pool::Pool(Backing* b, int frames) : b_(b) {
  frames = std::max(frames, 2);
  frames_.resize(size_t(frames));
}

void Pool::SetLog(Writer* log) {
  std::lock_guard<std::mutex> lock(mu_);
  log_ = log;
}

int64_t Pool::LogSize() const {
  return log_ ? log_->Size() : 0;
}

Frame* Pool::Fetch(PageNo no) { return Pin(no, true); }

void Pool::FlushAll() {
  std::lock_guard<std::mutex> lock(mu_);
  for (auto& f : frames_) {
    if (f.used) FlushFrame(&f);
  }
}

int Pool::Resident() const {
  std::lock_guard<std::mutex> lock(mu_);
  return int(table_.size());
}

int Pool::DirtyCount() const {
  std::lock_guard<std::mutex> lock(mu_);
  int n = 0;
  for (const auto& f : frames_) {
    if (f.used && f.dirty) ++n;
  }
  return n;
}

void Pool::ReadPage(PageNo no, uint8_t* buf, size_t len) {
  Frame* f = Pin(no, true);
  std::memcpy(buf, f->data.data(), len);
  Unpin(f, false);
}

void Pool::WritePage(PageNo no, const uint8_t* buf, size_t len) {
  (void)len;
  Frame* f = Pin(no, false);
  std::memcpy(f->data.data(), buf, kUsable);
  Unpin(f, true);
}

PageNo Pool::Allocate() {
  {
    std::lock_guard<std::mutex> lock(mu_);
    PageNo head = b_->meta().free_head;
    if (head != 0) {
      auto it = table_.find(head);
      if (it != table_.end()) FlushFrame(&frames_[it->second]);
    }
  }
  return b_->Allocate();
}

void Pool::Free(PageNo no) {
  {
    std::lock_guard<std::mutex> lock(mu_);
    auto it = table_.find(no);
    if (it != table_.end() && frames_[it->second].pins == 0) {
      frames_[it->second] = Frame();
      table_.erase(it);
    }
  }
  b_->Free(no);
}

Meta Pool::meta() const { return b_->meta(); }
void Pool::SetMeta(const Meta& m) { b_->SetMeta(m); }
PageNo Pool::Root() const { return b_->meta().root; }
void Pool::SetRoot(PageNo no) {
  Meta m = b_->meta();
  m.root = no;
  b_->SetMeta(m);
}

}  // namespace btreekv
