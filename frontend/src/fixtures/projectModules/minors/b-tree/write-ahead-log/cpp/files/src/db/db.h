#pragma once

#include "db/txn.h"
#include "pager/pager.h"
#include "wal/writer.h"

#include <functional>
#include <memory>
#include <mutex>
#include <string>

namespace btreekv {

struct Options {
  SyncMode sync = SyncMode::kAlways;
};

struct DBStats {
  int pages = 0;
  int free_pages = 0;
  int height = 0;
  int leaves = 0;
  int internal = 0;
  int keys = 0;
  int64_t wal_bytes = 0;
  int resident = 0;
  int dirty = 0;
};

class ClosedError : public std::runtime_error {
 public:
  using std::runtime_error::runtime_error;
};
class NotYetError : public std::runtime_error {
 public:
  using std::runtime_error::runtime_error;
};

class DB {
 public:
  static DB Open(const std::string& dir, Options opts = {});
  ~DB();

  DB(const DB&) = delete;
  DB& operator=(const DB&) = delete;
  DB(DB&&) noexcept;
  DB& operator=(DB&&) noexcept;

  void Put(std::string_view key, std::string_view value);
  bool Get(std::string_view key, std::string* value);
  void Delete(std::string_view key);
  void Scan(std::string_view start, std::string_view end,
            const std::function<bool(std::string_view, std::string_view)>& fn);
  DBStats Stats();
  void Close();

  // Used by recover / apply.
  const std::string& dir() const { return dir_; }
  const Options& opts() const { return opts_; }
  Store* store() { return store_.get(); }
  Writer* log() { return log_.get(); }
  void set_log(Writer* w) { log_.reset(w); }

 private:
  friend void RecoverLog(DB* d);
  friend void Commit(DB* d, Txn* t);
  friend void ApplyRecords(DB* d, const std::vector<Record>& recs);

  DB(std::string dir, Options opts, std::unique_ptr<Pager> pg);

  void Update(const std::function<void(Tree*)>& fn);
  void Checkpoint();

  mutable std::mutex mu_;
  std::string dir_;
  Options opts_;
  std::unique_ptr<Pager> pg_;
  std::unique_ptr<Store> store_;
  std::unique_ptr<Writer> log_;
  bool closed_ = false;
};

}  // namespace btreekv
