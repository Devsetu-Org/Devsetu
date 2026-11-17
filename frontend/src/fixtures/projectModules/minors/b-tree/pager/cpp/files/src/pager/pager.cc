#include "pager/pager.h"

#include <fcntl.h>
#include <sys/stat.h>
#include <unistd.h>

#include <stdexcept>
#include <vector>

namespace btreekv {

Pager::Pager(int fd, Meta meta) : fd_(fd), meta_(meta) {}

Pager::Pager(Pager&& other) noexcept : fd_(other.fd_), meta_(other.meta_) {
  other.fd_ = -1;
}

Pager& Pager::operator=(Pager&& other) noexcept {
  if (this != &other) {
    if (fd_ >= 0) ::close(fd_);
    fd_ = other.fd_;
    meta_ = other.meta_;
    other.fd_ = -1;
  }
  return *this;
}

Pager::~Pager() {
  if (fd_ >= 0) {
    try {
      Sync();
    } catch (...) {
    }
    ::close(fd_);
    fd_ = -1;
  }
}

Pager Pager::Open(const std::string& path) {
  int fd = ::open(path.c_str(), O_RDWR | O_CREAT, 0644);
  if (fd < 0) {
    throw std::runtime_error("pager: open failed");
  }
  struct stat st {};
  if (::fstat(fd, &st) != 0) {
    ::close(fd);
    throw std::runtime_error("pager: fstat failed");
  }

  // Transfer ownership of fd into Pager immediately so failures can't double-close.
  Pager p(fd, Meta{0, 1, 0});
  if (st.st_size == 0) {
    p.Sync();
    return p;
  }
  std::vector<uint8_t> buf(kPageSize);
  p.ReadPage(0, buf.data(), buf.size());
  p.meta_ = DecodeHeader(buf.data());
  return p;
}

Meta Pager::meta() const {
  std::lock_guard<std::mutex> lock(mu_);
  return meta_;
}

void Pager::SetMeta(const Meta& m) {
  std::lock_guard<std::mutex> lock(mu_);
  meta_ = m;
}

void Pager::SetRoot(PageNo no) {
  std::lock_guard<std::mutex> lock(mu_);
  meta_.root = no;
}

void Pager::Sync() {
  if (fd_ < 0) return;
  std::vector<uint8_t> buf(kPageSize);
  EncodeHeader(buf.data(), meta());
  WritePage(0, buf.data(), buf.size());
  if (::fsync(fd_) != 0) {
    throw std::runtime_error("pager: fsync failed");
  }
}

void Pager::Close() {
  if (fd_ < 0) return;
  Sync();
  if (::close(fd_) != 0) {
    fd_ = -1;
    throw std::runtime_error("pager: close failed");
  }
  fd_ = -1;
}

}  // namespace btreekv
