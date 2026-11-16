#include "pager/pager.h"

#include <stdexcept>
#include <vector>

namespace btreekv {

// Allocate returns a page number nobody else is using. It reuses a freed page
// when the freelist has one and otherwise grows the file by one page.
PageNo Pager::Allocate() {
  std::lock_guard<std::mutex> lock(mu_);
  // TODO(1.3)
  throw std::logic_error("TODO(1.3)");
}

// Free puts page no on the freelist so a later Allocate can reuse it.
void Pager::Free(PageNo no) {
  std::lock_guard<std::mutex> lock(mu_);
  // TODO(1.4)
  (void)no;
  throw std::logic_error("TODO(1.4)");
}

}  // namespace btreekv
