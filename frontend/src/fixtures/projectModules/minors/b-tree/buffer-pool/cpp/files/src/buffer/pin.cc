#include "buffer/pool.h"

#include <stdexcept>

namespace btreekv {

Frame* Pool::Pin(PageNo no, bool load) {
  // TODO(4.1)
  (void)no;
  (void)load;
  throw std::logic_error("TODO(4.1)");
}

void Pool::Unpin(Frame* f, bool dirty) {
  // TODO(4.1)
  (void)f;
  (void)dirty;
  throw std::logic_error("TODO(4.1)");
}

}  // namespace btreekv
