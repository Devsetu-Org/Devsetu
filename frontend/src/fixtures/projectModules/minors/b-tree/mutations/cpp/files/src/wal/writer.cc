#include "wal/writer.h"

#include <fcntl.h>
#include <unistd.h>

#include <stdexcept>
#include <system_error>

namespace btreekv {
namespace {

void FsyncFile(FILE* f) {
  if (std::fflush(f) != 0) {
    throw std::system_error(errno, std::generic_category(), "fflush");
  }
  if (::fsync(fileno(f)) != 0) {
    throw std::system_error(errno, std::generic_category(), "fsync");
  }
}

}  // namespace

Writer::Writer(FILE* f, SyncMode mode, int64_t size, int64_t synced)
    : f_(f), mode_(mode), size_(size), synced_(synced) {}

Writer::~Writer() {
  if (f_ != nullptr) {
    std::fclose(f_);
    f_ = nullptr;
  }
}

void Writer::Append(const std::vector<Record>& recs) {
  buf_.clear();
  for (const auto& r : recs) Encode(&buf_, r);
  size_t n = std::fwrite(buf_.data(), 1, buf_.size(), f_);
  size_ += int64_t(n);
  if (n != buf_.size()) {
    throw std::runtime_error("wal: short write");
  }
  if (mode_ == SyncMode::kAlways) Sync();
}

void Writer::Sync() {
  FsyncFile(f_);
  synced_ = size_;
}

void Writer::Rewind(int64_t to) {
  if (::ftruncate(fileno(f_), to) != 0) {
    throw std::system_error(errno, std::generic_category(), "truncate");
  }
  if (::fseeko(f_, to, SEEK_SET) != 0) {
    throw std::system_error(errno, std::generic_category(), "seek");
  }
  size_ = to;
  if (synced_ > to) synced_ = to;
}

void Writer::Reset() {
  Rewind(0);
  Sync();
}

void Writer::Close() {
  if (f_ == nullptr) return;
  Sync();
  std::fclose(f_);
  f_ = nullptr;
}

Writer* Create(const std::string& path, SyncMode mode) {
  FILE* f = std::fopen(path.c_str(), "wb");
  if (!f) throw std::system_error(errno, std::generic_category(), "Create");
  setvbuf(f, nullptr, _IONBF, 0);
  return new Writer(f, mode);
}

Writer* OpenAppend(const std::string& path, int64_t good, SyncMode mode) {
  FILE* f = std::fopen(path.c_str(), "r+b");
  if (!f) f = std::fopen(path.c_str(), "w+b");
  if (!f) throw std::system_error(errno, std::generic_category(), "OpenAppend");
  setvbuf(f, nullptr, _IONBF, 0);
  if (::ftruncate(fileno(f), good) != 0) {
    std::fclose(f);
    throw std::system_error(errno, std::generic_category(), "truncate");
  }
  if (::fseeko(f, good, SEEK_SET) != 0) {
    std::fclose(f);
    throw std::system_error(errno, std::generic_category(), "seek");
  }
  FsyncFile(f);
  return new Writer(f, mode, good, good);
}

}  // namespace btreekv
