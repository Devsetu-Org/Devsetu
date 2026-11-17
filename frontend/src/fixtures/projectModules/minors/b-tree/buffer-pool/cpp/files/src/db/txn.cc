#include "db/txn.h"

#include <algorithm>
#include <cstring>
#include <stdexcept>

namespace btreekv {

Txn::Txn(Store* base) : base_(base), start_(base->meta()), root_(base->meta().root) {}

void Txn::ReadPage(PageNo no, uint8_t* buf, size_t len) {
  auto it = pages_.find(no);
  if (it != pages_.end()) {
    if (len != it->second.size()) throw std::runtime_error("db: bad read size");
    std::memcpy(buf, it->second.data(), len);
    return;
  }
  for (PageNo f : freed_) {
    if (f == no) throw std::runtime_error("db: read of page after it was freed");
  }
  base_->ReadPage(no, buf, len);
}

void Txn::WritePage(PageNo no, const uint8_t* buf, size_t len) {
  if (len != kPageSize) throw std::runtime_error("db: write of a wrong-size buffer");
  pages_[no].assign(buf, buf + len);
}

PageNo Txn::Allocate() { return base_->Allocate(); }

void Txn::Free(PageNo no) {
  pages_.erase(no);
  freed_.push_back(no);
}

bool Txn::Dirty() const {
  return !pages_.empty() || !freed_.empty() || root_ != start_.root;
}

void Txn::Abort() { base_->SetMeta(start_); }

std::vector<Record> Txn::Records() {
  Meta meta = base_->meta();
  meta.root = root_;
  for (PageNo no : freed_) {
    std::vector<uint8_t> img(kPageSize, 0);
    EncodeFreePage(img.data(), meta.free_head);
    pages_[no] = std::move(img);
    meta.free_head = no;
  }
  std::vector<PageNo> nos;
  nos.reserve(pages_.size());
  for (const auto& kv : pages_) nos.push_back(kv.first);
  std::sort(nos.begin(), nos.end());

  std::vector<Record> recs;
  recs.reserve(nos.size() + 2);
  for (PageNo no : nos) {
    Record r;
    r.kind = WalKind::kPage;
    r.page = no;
    const auto& p = pages_[no];
    r.data.assign(reinterpret_cast<const char*>(p.data()), kUsable);
    recs.push_back(std::move(r));
  }
  recs.push_back(MetaRecord(meta.root, meta.page_count, meta.free_head));
  recs.push_back(CommitRecord());
  return recs;
}

}  // namespace btreekv
