#include "pager/pager.h"

#include <stdexcept>
#include <vector>

namespace btreekv {

// Allocate returns a page number nobody else is using. It reuses a freed page
// when the freelist has one and otherwise grows the file by one page.
PageNo Pager::Allocate() {
  std::lock_guard<std::mutex> lock(mu_);
  // TODO(1.3): If meta_.free_head != 0, pop it: read that page into a kPageSize
  // buffer, take the next pointer from DecodeFreePage, set meta_.free_head to
  // it, and return the popped page number. Do not write to disk.
  //
  // Otherwise return meta_.page_count, WritePage a blank page there so the file
  // really grows, and increment meta_.page_count.
  throw std::logic_error("TODO(1.3): Allocate");
}

// Free puts page no on the freelist so a later Allocate can reuse it.
void Pager::Free(PageNo no) {
  std::lock_guard<std::mutex> lock(mu_);
  // TODO(1.4): Throw BadPageError if no is 0 or >= meta_.page_count.
  // Build the page with EncodeFreePage(buf, meta_.free_head) in a kPageSize
  // buffer, WritePage it, and only then set meta_.free_head = no.
  (void)no;
  throw std::logic_error("TODO(1.4): Free");
}

}  // namespace btreekv
