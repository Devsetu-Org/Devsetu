#pragma once

#include "wal/record.h"

#include <cstdint>
#include <cstdio>
#include <string>
#include <vector>

namespace btreekv {

enum class SyncMode : uint8_t {
  kAlways = 0,
  kNever = 1,
};

class Writer {
 public:
  Writer(FILE* f, SyncMode mode, int64_t size = 0, int64_t synced = 0);
  ~Writer();

  Writer(const Writer&) = delete;
  Writer& operator=(const Writer&) = delete;

  // Student: encode every record into one buffer, one write, fsync under kAlways.
  void Append(const std::vector<Record>& recs);

  void Sync();
  int64_t Size() const { return size_; }
  int64_t Durable() const { return synced_; }
  void Rewind(int64_t to);
  void Reset();
  void Close();

 private:
  FILE* f_ = nullptr;
  SyncMode mode_;
  std::vector<uint8_t> buf_;
  int64_t size_ = 0;
  int64_t synced_ = 0;
};

Writer* Create(const std::string& path, SyncMode mode);
Writer* OpenAppend(const std::string& path, int64_t good, SyncMode mode);

}  // namespace btreekv
