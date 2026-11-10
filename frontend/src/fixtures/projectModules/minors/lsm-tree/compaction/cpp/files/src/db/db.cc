#include "db/db.h"
#include "manifest/manifest.h"
#include <dirent.h>
#include <unistd.h>
#include <cstdio>
#include <sys/stat.h>
#include <algorithm>
#include <cstring>
#include <system_error>
#include <unordered_set>
namespace lsmkv { namespace db {
Options Options::withDefaults() const {
  Options o = *this;
  if (o.memtable_size <= 0) o.memtable_size = 4 << 20;
  if (o.block_size <= 0) o.block_size = sstable::kDefaultBlockSize;
  if (o.bloom_bits_per_key == 0) o.bloom_bits_per_key = 10;
  if (o.compaction_trigger == 0) o.compaction_trigger = 4;
  return o;
}
DB::DB(std::string dir, Options opts) : dir_(std::move(dir)), opts_(opts.withDefaults()) {}
DB::~DB() {
  if (log_) { try { log_->Close(); } catch (...) {} log_.reset(); }
  for (auto& tb : tables_) if (tb.t) tb.t->Close();
}
void Apply(Memtable* m, const wal::Record& r) {
  if (r.kind == Kind::kTombstone) m->Delete(r.key);
  else m->Put(r.key, r.value);
}
std::string TablePath(const std::string& dir, uint64_t num) {
  char buf[64];
  std::snprintf(buf, sizeof(buf), "%06llu%s", static_cast<unsigned long long>(num), kTableExt);
  return dir + "/" + buf;
}
void SyncDir(const std::string& dir) {
  FILE* f = fopen(dir.c_str(), "r");
  if (!f) throw std::system_error(errno, std::generic_category(), "opendir");
  if (fsync(fileno(f)) != 0) { fclose(f); throw std::system_error(errno, std::generic_category(), "fsync"); }
  fclose(f);
}
sstable::WriterOptions DB::writerOptions() const {
  return sstable::WriterOptions{opts_.block_size, opts_.bloom_bits_per_key > 0 ? opts_.bloom_bits_per_key : 0};
}
void DB::addTable(TableRef tb) {
  // Commit the new live set in the manifest before making the table visible.
  // On Save failure, release ownership so flush()'s catch can Close via its
  // raw pointer (flush.cc is a carry-forward and must stay unchanged).
  std::vector<uint64_t> nums;
  nums.reserve(tables_.size() + 1);
  nums.push_back(tb.num);
  for (auto& existing : tables_) nums.push_back(existing.num);
  manifest::State st;
  st.next_file = next_file_;
  st.tables = std::move(nums);
  try {
    manifest::Save(dir_, st);
  } catch (...) {
    tb.t.release();
    throw;
  }
  tables_.insert(tables_.begin(), std::move(tb));
}
void DB::openTables() {
  auto st = manifest::Load(dir_);
  next_file_ = st.next_file;
  std::unordered_set<uint64_t> live;
  for (uint64_t num : st.tables) {
    auto t = sstable::Open(TablePath(dir_, num));
    tables_.push_back(TableRef{num, std::move(t)});
    live.insert(num);
  }
  DIR* d = opendir(dir_.c_str());
  if (!d) throw std::system_error(errno, std::generic_category(), "opendir");
  while (dirent* e = readdir(d)) {
    std::string name = e->d_name;
    bool is_tmp = name.size() > std::strlen(kTmpExt) &&
                  name.substr(name.size() - std::strlen(kTmpExt)) == kTmpExt;
    bool is_sst = name.size() > std::strlen(kTableExt) &&
                  name.substr(name.size() - std::strlen(kTableExt)) == kTableExt;
    bool orphan = false;
    if (is_sst) {
      try {
        uint64_t n = std::stoull(name.substr(0, name.size() - std::strlen(kTableExt)));
        orphan = live.find(n) == live.end();
      } catch (...) {
        orphan = false;
      }
    }
    if (orphan || is_tmp) ::remove((dir_ + "/" + name).c_str());
  }
  closedir(d);
}
void DB::Put(std::string_view key, std::string_view value) {
  wal::Record r; r.kind = Kind::kValue; r.key.assign(key.data(), key.size()); r.value.assign(value.data(), value.size());
  std::lock_guard lock(mu_);
  if (!log_) throw ErrClosed();
  Commit(r);
  if (static_cast<int>(mem_.ApproximateSize()) >= opts_.memtable_size) {
    flush();
    if (opts_.compaction_trigger > 0 &&
        static_cast<int>(tables_.size()) >= opts_.compaction_trigger) {
      compactRange(0, static_cast<int>(tables_.size()));
    }
  }
}
void DB::Delete(std::string_view key) {
  wal::Record r; r.kind = Kind::kTombstone; r.key.assign(key.data(), key.size());
  std::lock_guard lock(mu_);
  if (!log_) throw ErrClosed();
  Commit(r);
  if (static_cast<int>(mem_.ApproximateSize()) >= opts_.memtable_size) {
    flush();
    if (opts_.compaction_trigger > 0 &&
        static_cast<int>(tables_.size()) >= opts_.compaction_trigger) {
      compactRange(0, static_cast<int>(tables_.size()));
    }
  }
}
void DB::Flush() {
  std::lock_guard lock(mu_);
  if (!log_) throw ErrClosed();
  flush();
}
bool DB::Get(std::string_view key, std::string* value) {
  std::lock_guard lock(mu_);
  if (!log_) throw ErrClosed();
  Result res = mem_.Get(key, value);
  if (res == Result::kFound) return true;
  if (res == Result::kDeleted) return false;
  for (auto& tb : tables_) {
    res = tb.t->Get(key, value);
    if (res == Result::kFound) return true;
    if (res == Result::kDeleted) return false;
  }
  return false;
}
Stats DB::GetStats() {
  std::lock_guard lock(mu_);
  Stats s;
  s.memtable_entries = mem_.Len();
  s.memtable_bytes = mem_.ApproximateSize();
  s.tables = static_cast<int>(tables_.size());
  s.compactions = compactions_;
  if (log_) s.wal_bytes = log_->Size();
  return s;
}
void DB::Close() {
  std::lock_guard lock(mu_);
  if (!log_) throw ErrClosed();
  log_->Close();
  log_.reset();
  for (auto& tb : tables_) if (tb.t) tb.t->Close();
  tables_.clear();
}
std::unique_ptr<DB> Open(const std::string& dir, Options opts) {
  if (mkdir(dir.c_str(), 0755) != 0 && errno != EEXIST)
    throw std::system_error(errno, std::generic_category(), "mkdir");
  auto d = std::make_unique<DB>(dir, opts);
  d->openTables();
  try { d->RecoverLog(); } catch (...) {
    for (auto& tb : d->tables_) if (tb.t) tb.t->Close();
    throw;
  }
  return d;
}
}} 

namespace lsmkv { namespace db {
void DB::saveManifest(const std::vector<TableRef>& tables) {
  manifest::State st;
  st.next_file = next_file_;
  for (auto& tb : tables) st.tables.push_back(tb.num);
  manifest::Save(dir_, st);
}
void DB::Compact() {
  std::lock_guard lock(mu_);
  if (!log_) throw ErrClosed();
  if (!tables_.empty()) compactRange(0, static_cast<int>(tables_.size()));
}
}} 
