#include "db/db.h"

#include <sys/stat.h>

#include <stdexcept>

namespace btreekv {
namespace {
constexpr const char* kDataName = "data.db";
}

DB::DB(std::string dir, Options opts, std::unique_ptr<Pager> pg)
    : dir_(std::move(dir)), opts_(opts), pg_(std::move(pg)) {
  io_ = std::make_unique<PagerIO>(pg_.get());
  tree_ = std::make_unique<Tree>(io_.get());
}

DB::DB(DB&& o) noexcept
    : dir_(std::move(o.dir_)),
      opts_(o.opts_),
      pg_(std::move(o.pg_)),
      io_(std::move(o.io_)),
      tree_(std::move(o.tree_)),
      closed_(o.closed_) {
  o.closed_ = true;
}

DB& DB::operator=(DB&& o) noexcept {
  if (this != &o) {
    dir_ = std::move(o.dir_);
    opts_ = o.opts_;
    pg_ = std::move(o.pg_);
    io_ = std::move(o.io_);
    tree_ = std::move(o.tree_);
    closed_ = o.closed_;
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
  return DB(dir, opts, std::move(pg));
}

void DB::Put(std::string_view key, std::string_view value) {
  std::lock_guard<std::mutex> lock(mu_);
  if (closed_) throw ClosedError("db: closed");
  tree_->Insert(key, value);
}

bool DB::Get(std::string_view key, std::string* value) {
  std::lock_guard<std::mutex> lock(mu_);
  if (closed_) throw ClosedError("db: closed");
  return tree_->Get(key, value);
}

void DB::Delete(std::string_view /*key*/) {
  throw NotYetError("db: not built yet (chapter 5)");
}

void DB::Scan(std::string_view, std::string_view,
              const std::function<bool(std::string_view, std::string_view)>&) {
  throw NotYetError("db: not built yet (chapter 5)");
}

DBStats DB::Stats() {
  std::lock_guard<std::mutex> lock(mu_);
  if (closed_) throw ClosedError("db: closed");
  TreeStats ts = tree_->Check();
  int pages = int(pg_->meta().page_count);
  DBStats s;
  s.pages = pages;
  s.free_pages = pages - 1 - ts.leaves - ts.internal;
  s.height = ts.height;
  s.leaves = ts.leaves;
  s.internal = ts.internal;
  s.keys = ts.keys;
  return s;
}

void DB::Close() {
  std::lock_guard<std::mutex> lock(mu_);
  if (closed_) throw ClosedError("db: closed");
  closed_ = true;
  pg_->Close();
}

}  // namespace btreekv
