#pragma once

#include <cstdint>
#include <cstdio>
#include <string>

#include "wal/record.h"

namespace lsmkv {
namespace wal {

// When an append is pushed from the OS page cache to disk.
enum class SyncMode : uint8_t {
  // fsync after every append. An acknowledged write survives a power cut.
  // This is the default.
  kAlways = 0,
  // Leave flushing to the OS. A process crash loses nothing (the page cache
  // survives it), but a power cut can lose the last few seconds.
  kNever = 1,
};

// Appends records to one log file.
class Writer {
 public:
  Writer(FILE* f, SyncMode mode, int64_t size = 0);
  ~Writer();

  Writer(const Writer&) = delete;
  Writer& operator=(const Writer&) = delete;

  // Writes r to the end of the log. When it returns under kAlways, the
  // record is on disk.
  void Append(const Record& r);

  int64_t Size() const { return size_; }

  // Syncs and closes the file.
  void Close();

 private:
  FILE* f_ = nullptr;
  SyncMode mode_;
  std::string buf_;
  int64_t size_ = 0;
};

// Makes an empty log at path, replacing any file already there.
Writer* Create(const std::string& path, SyncMode mode);

// Opens the log at path for appending after its first good bytes, cutting
// off anything beyond them. The file is created if it does not exist.
Writer* OpenAppend(const std::string& path, int64_t good, SyncMode mode);

}  // namespace wal
}  // namespace lsmkv
