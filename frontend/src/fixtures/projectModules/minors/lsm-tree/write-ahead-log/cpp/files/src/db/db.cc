#include "db/db.h"

#include <sys/stat.h>

#include <system_error>

namespace lsmkv {
namespace db {

DB::DB(std::string dir, Options opts) : dir_(std::move(dir)), opts_(opts) {}

DB::~DB() {
  if (log_) {
    try {
      log_->Close();
    } catch (...) {
    }
    log_.reset();
  }
}

void Apply(Memtable* m, const wal::Record& r) {
  if (r.kind == Kind::kTombstone) {
    m->Delete(r.key);
  } else {
    m->Put(r.key, r.value);
  }
}

void DB::Put(std::string_view key, std::string_view value) {
  wal::Record r;
  r.kind = Kind::kValue;
  r.key.assign(key.data(), key.size());
  r.value.assign(value.data(), value.size());
  std::lock_guard lock(mu_);
  if (!log_) throw ErrClosed();
  Commit(r);
}

void DB::Delete(std::string_view key) {
  wal::Record r;
  r.kind = Kind::kTombstone;
  r.key.assign(key.data(), key.size());
  std::lock_guard lock(mu_);
  if (!log_) throw ErrClosed();
  Commit(r);
}

bool DB::Get(std::string_view key, std::string* value) {
  std::lock_guard lock(mu_);
  if (!log_) throw ErrClosed();
  Result res = mem_.Get(key, value);
  return res == Result::kFound;
}

Stats DB::GetStats() {
  std::lock_guard lock(mu_);
  Stats s;
  s.memtable_entries = mem_.Len();
  s.memtable_bytes = mem_.ApproximateSize();
  if (log_) s.wal_bytes = log_->Size();
  return s;
}

void DB::Close() {
  std::lock_guard lock(mu_);
  if (!log_) throw ErrClosed();
  log_->Close();
  log_.reset();
}

std::unique_ptr<DB> Open(const std::string& dir, Options opts) {
  if (mkdir(dir.c_str(), 0755) != 0 && errno != EEXIST) {
    throw std::system_error(errno, std::generic_category(), "mkdir");
  }
  auto d = std::make_unique<DB>(dir, opts);
  d->RecoverLog();
  return d;
}

}  // namespace db
}  // namespace lsmkv
