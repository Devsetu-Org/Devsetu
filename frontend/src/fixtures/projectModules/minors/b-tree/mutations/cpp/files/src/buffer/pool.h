#pragma once

#include "db/txn.h"
#include "pager/pager.h"
#include "wal/writer.h"

#include <mutex>
#include <stdexcept>
#include <unordered_map>
#include <vector>

namespace btreekv {

class PoolFullError : public std::runtime_error {
 public:
  using std::runtime_error::runtime_error;
};

// Page layer under the pool.
class Backing {
 public:
  virtual ~Backing() = default;
  virtual void ReadPage(PageNo no, uint8_t* buf, size_t len) = 0;
  virtual void WritePage(PageNo no, const uint8_t* buf, size_t len) = 0;
  virtual PageNo Allocate() = 0;
  virtual void Free(PageNo no) = 0;
  virtual Meta meta() const = 0;
  virtual void SetMeta(const Meta& m) = 0;
};

class PagerBacking : public Backing {
 public:
  explicit PagerBacking(Pager* p) : p_(p) {}
  void ReadPage(PageNo no, uint8_t* buf, size_t len) override { p_->ReadPage(no, buf, len); }
  void WritePage(PageNo no, const uint8_t* buf, size_t len) override { p_->WritePage(no, buf, len); }
  PageNo Allocate() override { return p_->Allocate(); }
  void Free(PageNo no) override { p_->Free(no); }
  Meta meta() const override { return p_->meta(); }
  void SetMeta(const Meta& m) override { p_->SetMeta(m); }

 private:
  Pager* p_;
};

struct Frame {
  PageNo no = 0;
  std::vector<uint8_t> data;
  bool used = false;
  int pins = 0;
  bool ref = false;
  bool dirty = false;
  int64_t lsn = 0;

  Frame() : data(kPageSize, 0) {}
};

class Pool : public Store {
 public:
  Pool(Backing* b, int frames);

  void SetLog(Writer* log);
  int64_t LogSize() const;
  Frame* Fetch(PageNo no);  // pin(no, true)
  void FlushAll();
  int Resident() const;
  int DirtyCount() const;

  // Student
  Frame* Pin(PageNo no, bool load);
  void Unpin(Frame* f, bool dirty);
  int Victim();  // returns frame index; throws PoolFullError
  void FlushFrame(Frame* f);

  // Store / PageIO
  void ReadPage(PageNo no, uint8_t* buf, size_t len) override;
  void WritePage(PageNo no, const uint8_t* buf, size_t len) override;
  PageNo Allocate() override;
  void Free(PageNo no) override;
  PageNo Root() const override;
  void SetRoot(PageNo no) override;
  Meta meta() const override;
  void SetMeta(const Meta& m) override;

  // Exposed for student methods (same package in Go).
  std::mutex& mu() { return mu_; }
  Backing* backing() { return b_; }
  Writer* log() { return log_; }
  std::vector<Frame>& frames() { return frames_; }
  std::unordered_map<PageNo, int>& table() { return table_; }
  int& hand() { return hand_; }

 private:
  mutable std::mutex mu_;
  Backing* b_;
  Writer* log_ = nullptr;
  std::vector<Frame> frames_;
  std::unordered_map<PageNo, int> table_;
  int hand_ = 0;
};

}  // namespace btreekv
