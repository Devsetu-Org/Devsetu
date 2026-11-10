#pragma once

#include "btree/tree.h"
#include "pager/pager.h"
#include "wal/record.h"

#include <map>
#include <vector>

namespace btreekv {

// Page layer the DB sits on: pager in ch3, buffer pool in ch4.
class Store : public PageIO {
 public:
  virtual Meta meta() const = 0;
  virtual void SetMeta(const Meta& m) = 0;
};

class PagerStore : public Store {
 public:
  explicit PagerStore(Pager* p) : p_(p) {}
  void ReadPage(PageNo no, uint8_t* buf, size_t len) override { p_->ReadPage(no, buf, len); }
  void WritePage(PageNo no, const uint8_t* buf, size_t len) override { p_->WritePage(no, buf, len); }
  PageNo Allocate() override { return p_->Allocate(); }
  void Free(PageNo no) override { p_->Free(no); }
  PageNo Root() const override { return p_->Root(); }
  void SetRoot(PageNo no) override { p_->SetRoot(no); }
  Meta meta() const override { return p_->meta(); }
  void SetMeta(const Meta& m) override { p_->SetMeta(m); }

 private:
  Pager* p_;
};

// In-memory write transaction. Tree runs over it as PageIO.
class Txn : public PageIO {
 public:
  explicit Txn(Store* base);

  void ReadPage(PageNo no, uint8_t* buf, size_t len) override;
  void WritePage(PageNo no, const uint8_t* buf, size_t len) override;
  PageNo Allocate() override;
  void Free(PageNo no) override;
  PageNo Root() const override { return root_; }
  void SetRoot(PageNo no) override { root_ = no; }

  bool Dirty() const;
  void Abort();
  std::vector<Record> Records();

 private:
  Store* base_;
  Meta start_;
  std::map<PageNo, std::vector<uint8_t>> pages_;
  std::vector<PageNo> freed_;
  PageNo root_ = 0;
};

}  // namespace btreekv
