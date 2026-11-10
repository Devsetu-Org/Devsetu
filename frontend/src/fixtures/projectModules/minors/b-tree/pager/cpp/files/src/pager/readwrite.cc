#include "pager/pager.h"

#include <stdexcept>

namespace btreekv {

// WritePage writes buf, which must be exactly kPageSize bytes, as page no. Only
// the first kUsable bytes are kept: the last kTrailerSize bytes of the page on
// disk are a fresh CRC-32C of those bytes. WritePage does not modify buf.
void Pager::WritePage(PageNo no, const uint8_t* buf, size_t len) {
  // TODO(1.1): Call CheckBuf(buf, len) first. Copy buf[0..kUsable) into a local
  // uint8_t page[kPageSize], store Crc32c(page, kUsable) in page[kUsable..] as
  // little-endian uint32, then pwrite all of page at offset
  // int64_t(no) * kPageSize on fd_. Do not touch buf: callers reuse it.
  //
  // You will need #include <unistd.h> and <cstring>.
  (void)no;
  (void)buf;
  (void)len;
  throw std::logic_error("TODO(1.1): WritePage");
}

// ReadPage fills buf, which must be exactly kPageSize bytes, with page no and
// verifies its checksum. A page that fails the check throws ChecksumError; a
// page past the end of the file throws BadPageError.
void Pager::ReadPage(PageNo no, uint8_t* buf, size_t len) {
  // TODO(1.2): Call CheckBuf(buf, len) first, then pread into buf at
  // int64_t(no) * kPageSize. If fewer than kPageSize bytes came back, throw
  // BadPageError. Otherwise compare the trailer (little-endian uint32 at
  // buf[kUsable]) with Crc32c(buf, kUsable) and throw ChecksumError on a
  // mismatch.
  (void)no;
  (void)buf;
  (void)len;
  throw std::logic_error("TODO(1.2): ReadPage");
}

}  // namespace btreekv
