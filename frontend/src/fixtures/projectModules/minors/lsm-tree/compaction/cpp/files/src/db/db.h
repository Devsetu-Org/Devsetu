#pragma once
#include <functional>
#include <memory>
#include <mutex>
#include <stdexcept>
#include <string>
#include <string_view>
#include <vector>
#include "memtable/memtable.h"
#include "sstable/reader.h"
#include "sstable/writer.h"
#include "wal/record.h"
#include "wal/writer.h"
namespace lsmkv { namespace db {
inline constexpr const char* kWalName = "wal.log";
inline constexpr const char* kTableExt = ".sst";
inline constexpr const char* kTmpExt = ".tmp";
class ErrClosed : public std::runtime_error { public: ErrClosed() : std::runtime_error("db: closed") {} };
struct Options {
  wal::SyncMode sync = wal::SyncMode::kAlways;
  int memtable_size = 0;
  int block_size = 0;
  int bloom_bits_per_key = 0;
  // Zero means 4; negative disables automatic compaction (Compact still works).
  int compaction_trigger = 0;
  Options withDefaults() const;
};
struct Stats {
  size_t memtable_entries = 0;
  size_t memtable_bytes = 0;
  int64_t wal_bytes = 0;
  int tables = 0;
  int compactions = 0;
};
struct TableRef {
  uint64_t num = 0;
  std::unique_ptr<sstable::Table> t;
};
class DB {
 public:
  DB(std::string dir, Options opts);
  ~DB();
  DB(const DB&) = delete;
  DB& operator=(const DB&) = delete;
  void Put(std::string_view key, std::string_view value);
  void Delete(std::string_view key);
  bool Get(std::string_view key, std::string* value);
  void Flush();
  void Scan(std::string_view start, std::string_view end,
            const std::function<bool(std::string_view, std::string_view)>& fn);
  Stats GetStats();
  void Close();
  void RecoverLog();
  void Commit(const wal::Record& r);
  void flush();
  void compactRange(int lo, int hi);
  void saveManifest(const std::vector<TableRef>& tables);
  void Compact();
  sstable::WriterOptions writerOptions() const;
  void addTable(TableRef tb);
  void openTables();
  std::mutex mu_;
  std::string dir_;
  Options opts_;
  Memtable mem_;
  std::unique_ptr<wal::Writer> log_;
  std::vector<TableRef> tables_;  // newest first
  uint64_t next_file_ = 1;
  int compactions_ = 0;
};
void Apply(Memtable* m, const wal::Record& r);
std::string TablePath(const std::string& dir, uint64_t num);
void SyncDir(const std::string& dir);
std::unique_ptr<DB> Open(const std::string& dir, Options opts = {});
}} 
