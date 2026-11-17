#include "pager/pager.h"

#include <stdexcept>

namespace btreekv {

// WritePage writes buf, which must be exactly kPageSize bytes, as page no. Only
// the first kUsable bytes are kept: the last kTrailerSize bytes of the page on
// disk are a fresh CRC-32C of those bytes. WritePage does not modify buf.
void Pager::WritePage(PageNo no, const uint8_t* buf, size_t len) {
  // TODO(1.1)
  (void)no;
  (void)buf;
  (void)len;
  throw std::logic_error("TODO(1.1)");
}

// ReadPage fills buf, which must be exactly kPageSize bytes, with page no and
// verifies its checksum. A page that fails the check throws ChecksumError; a
// page past the end of the file throws BadPageError.
void Pager::ReadPage(PageNo no, uint8_t* buf, size_t len) {
  // TODO(1.2)
  (void)no;
  (void)buf;
  (void)len;
  throw std::logic_error("TODO(1.2)");
}

}  // namespace btreekv
