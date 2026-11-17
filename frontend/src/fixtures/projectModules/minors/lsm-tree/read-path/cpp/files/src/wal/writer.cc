#include "wal/writer.h"

#include <unistd.h>

#include <system_error>

namespace lsmkv {
namespace wal {
namespace {

void FsyncFile(FILE* f) {
  if (fflush(f) != 0) {
    throw std::system_error(errno, std::generic_category(), "fflush");
  }
  if (fsync(fileno(f)) != 0) {
    throw std::system_error(errno, std::generic_category(), "fsync");
  }
}

}  // namespace

Writer::Writer(FILE* f, SyncMode mode, int64_t size) : f_(f), mode_(mode), size_(size) {}

Writer::~Writer() {
  if (f_ != nullptr) {
    fclose(f_);
    f_ = nullptr;
  }
}

void Writer::Append(const Record& r) {
  buf_.clear();
  Encode(&buf_, r);
  size_t n = fwrite(buf_.data(), 1, buf_.size(), f_);
  size_ += static_cast<int64_t>(n);
  if (n != buf_.size()) {
    throw std::system_error(errno, std::generic_category(), "fwrite");
  }
  if (mode_ == SyncMode::kAlways) {
    FsyncFile(f_);
  }
}

void Writer::Close() {
  if (f_ == nullptr) return;
  FsyncFile(f_);
  fclose(f_);
  f_ = nullptr;
}

Writer* Create(const std::string& path, SyncMode mode) {
  FILE* f = fopen(path.c_str(), "wb");
  if (f == nullptr) {
    throw std::system_error(errno, std::generic_category(), "Create");
  }
  setvbuf(f, nullptr, _IONBF, 0);
  return new Writer(f, mode);
}

Writer* OpenAppend(const std::string& path, int64_t good, SyncMode mode) {
  FILE* f = fopen(path.c_str(), "r+b");
  if (f == nullptr) {
    f = fopen(path.c_str(), "w+b");
  }
  if (f == nullptr) {
    throw std::system_error(errno, std::generic_category(), "OpenAppend");
  }
  setvbuf(f, nullptr, _IONBF, 0);
  if (ftruncate(fileno(f), good) != 0) {
    fclose(f);
    throw std::system_error(errno, std::generic_category(), "truncate");
  }
  if (fseeko(f, good, SEEK_SET) != 0) {
    fclose(f);
    throw std::system_error(errno, std::generic_category(), "seek");
  }
  FsyncFile(f);
  return new Writer(f, mode, good);
}

}  // namespace wal
}  // namespace lsmkv
