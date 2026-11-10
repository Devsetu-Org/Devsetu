#include "db/db.h"

#include "db/apply.h"
#include "db/recover.h"
#include "btree/tree.h"

#include <sys/stat.h>

#include <stdexcept>

namespace btreekv {
namespace {
constexpr const char* kDataName = "data.db";
constexpr int kDefaultFrames = 256;
}

DB::DB(std::string dir, Options opts, std::unique_ptr<Pager> pg)
    : dir_(std::move(dir)), opts_(opts), pg_(std::move(pg)) {
  backing_ = std::make_unique<PagerBacking>(pg_.get());
  int frames = opts_.pool_frames > 0 ? opts_.pool_frames : kDefaultFrames;
  pool_ = std::make_unique<Pool>(backing_.get(), frames);
  store_ = pool_.get();
}

DB::DB(DB&& o) noexcept
    : dir_(std::move(o.dir_)),
      opts_(o.opts_),
      pg_(std::move(o.pg_)),
      backing_(std::move(o.backing_)),
      pool_(std::move(o.pool_)),
      store_(o.store_),
      log_(std::move(o.log_)),
      closed_(o.closed_) {
  o.store_ = nullptr;
  o.closed_ = true;
}

DB& DB::operator=(DB&& o) noexcept {
  if (this != &o) {
    dir_ = std::move(o.dir_);
    opts_ = o.opts_;
    pg_ = std::move(o.pg_);
    backing_ = std::move(o.backing_);
    pool_ = std::move(o.pool_);
    store_ = o.store_;
    log_ = std::move(o.log_);
    closed_ = o.closed_;
    o.store_ = nullptr;
    o.closed_ = true;
  }
  return *this;
}

DB::~DB() {
  if (!closed_ && pg_) {
    try {
      Close();
    } catch (...) {
    }
  }
}

DB DB::Open(const std::string& dir, Options opts) {
  ::mkdir(dir.c_str(), 0755);
  auto pg = std::make_unique<Pager>(Pager::Open(dir + "/" + kDataName));
  DB d(dir, opts, std::move(pg));
  try {
    RecoverLog(&d);
  } catch (...) {
    d.pg_->Close();
    d.closed_ = true;
    throw;
  }
  d.pool_->SetLog(d.log_.get());
  return d;
}

void DB::Update(const std::function<void(Tree*)>& fn) {
  if (closed_) throw ClosedError("db: closed");
  Txn tx(store_);
  try {
    Tree t(&tx);
    fn(&t);
  } catch (...) {
    tx.Abort();
    throw;
  }
  if (!tx.Dirty()) return;
  try {
    Commit(this, &tx);
  } catch (...) {
    tx.Abort();
    throw;
  }
}

void DB::Put(std::string_view key, std::string_view value) {
  std::lock_guard<std::mutex> lock(mu_);
  Update([&](Tree* t) { t->Insert(key, value); });
}

bool DB::Get(std::string_view key, std::string* value) {
  std::lock_guard<std::mutex> lock(mu_);
  if (closed_) throw ClosedError("db: closed");
  Tree t(store_);
  return t.Get(key, value);
}

void DB::Delete(std::string_view key) {
  std::lock_guard<std::mutex> lock(mu_);
  Update([&](Tree* t) { (void)t->Delete(key); });
}

void ScanImpl(DB* d, std::string_view start, std::string_view end,
              const std::function<bool(std::string_view, std::string_view)>& fn);

void DB::Scan(std::string_view start, std::string_view end,
              const std::function<bool(std::string_view, std::string_view)>& fn) {
  std::lock_guard<std::mutex> lock(mu_);
  if (closed_) throw ClosedError("db: closed");
  ScanImpl(this, start, end, fn);
}

DBStats DB::Stats() {
  std::lock_guard<std::mutex> lock(mu_);
  if (closed_) throw ClosedError("db: closed");
  Tree t(store_);
  TreeStats ts = t.Check();
  int pages = int(store_->meta().page_count);
  DBStats s;
  s.pages = pages;
  s.free_pages = pages - 1 - ts.leaves - ts.internal;
  s.height = ts.height;
  s.leaves = ts.leaves;
  s.internal = ts.internal;
  s.keys = ts.keys;
  s.wal_bytes = log_ ? log_->Size() : 0;
  s.resident = pool_ ? pool_->Resident() : 0;
  s.dirty = pool_ ? pool_->DirtyCount() : 0;
  return s;
}

void DB::Checkpoint() {
  if (pool_) pool_->FlushAll();
  pg_->Sync();
  if (log_) log_->Reset();
}

void DB::Close() {
  std::lock_guard<std::mutex> lock(mu_);
  if (closed_) throw ClosedError("db: closed");
  closed_ = true;
  Checkpoint();
  if (log_) log_->Close();
  pg_->Close();
}

}  // namespace btreekv
