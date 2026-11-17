#pragma once

// The storage engine: the public Put / Delete / Get API over the write-ahead
// log and the memtable. Later chapters add SSTables and compaction underneath
// without changing this API.

#include <memory>
#include <mutex>
#include <stdexcept>
#include <string>
#include <string_view>

#include "memtable/memtable.h"
#include "wal/record.h"
#include "wal/writer.h"

namespace lsmkv {
namespace db {

// The log file inside the data directory.
inline constexpr const char* kWalName = "wal.log";

class ErrClosed : public std::runtime_error {
 public:
  ErrClosed() : std::runtime_error("db: closed") {}
};

// Tune a DB. The zero value is safe: every write is fsynced.
struct Options {
  wal::SyncMode sync = wal::SyncMode::kAlways;
};

// Snapshot of the store's size for the REPL.
struct Stats {
  size_t memtable_entries = 0;
  size_t memtable_bytes = 0;
  int64_t wal_bytes = 0;
};

// An open store in one directory. Safe for concurrent use.
class DB {
 public:
  DB(std::string dir, Options opts);
  ~DB();

  DB(const DB&) = delete;
  DB& operator=(const DB&) = delete;

  void Put(std::string_view key, std::string_view value);
  void Delete(std::string_view key);

  // Returns true and sets *value when the key exists.
  bool Get(std::string_view key, std::string* value);

  Stats GetStats();
  void Close();

  // Student-owned (recover.cc).
  void RecoverLog();
  void Commit(const wal::Record& r);

  // Visible to recover.cc / tests.
  std::mutex mu_;
  std::string dir_;
  Options opts_;
  Memtable mem_;
  std::unique_ptr<wal::Writer> log_;
};

// Makes one logged write visible in the memtable.
void Apply(Memtable* m, const wal::Record& r);

// Opens the store in dir, creating it if needed, and recovers every
// acknowledged write from the log.
std::unique_ptr<DB> Open(const std::string& dir, Options opts = {});

}  // namespace db
}  // namespace lsmkv
