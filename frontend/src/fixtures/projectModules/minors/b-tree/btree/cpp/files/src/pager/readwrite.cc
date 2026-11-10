#include "pager/pager.h"

#include <cstring>
#include <unistd.h>

namespace btreekv {
namespace {

void PutLE32(uint8_t* p, uint32_t v) {
  p[0] = static_cast<uint8_t>(v);
  p[1] = static_cast<uint8_t>(v >> 8);
  p[2] = static_cast<uint8_t>(v >> 16);
  p[3] = static_cast<uint8_t>(v >> 24);
}

uint32_t GetLE32(const uint8_t* p) {
  return uint32_t(p[0]) | (uint32_t(p[1]) << 8) | (uint32_t(p[2]) << 16) | (uint32_t(p[3]) << 24);
}

}  // namespace

void Pager::WritePage(PageNo no, const uint8_t* buf, size_t len) {
  CheckBuf(buf, len);
  uint8_t page[kPageSize];
  std::memcpy(page, buf, kUsable);
  std::memset(page + kUsable, 0, kPageSize - kUsable);
  PutLE32(page + kUsable, Crc32c(page, kUsable));
  ssize_t n = ::pwrite(fd_, page, kPageSize, static_cast<off_t>(no) * kPageSize);
  if (n != static_cast<ssize_t>(kPageSize)) {
    throw std::runtime_error("pager: WritePage short write");
  }
}

void Pager::ReadPage(PageNo no, uint8_t* buf, size_t len) {
  CheckBuf(buf, len);
  ssize_t n = ::pread(fd_, buf, kPageSize, static_cast<off_t>(no) * kPageSize);
  if (n < static_cast<ssize_t>(kPageSize)) {
    throw BadPageError("pager: bad page: page is past the end of the file");
  }
  uint32_t want = GetLE32(buf + kUsable);
  if (Crc32c(buf, kUsable) != want) {
    throw ChecksumError("pager: page checksum mismatch");
  }
}

}  // namespace btreekv
