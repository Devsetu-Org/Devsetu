#include "buffer/pool.h"

#include <stdexcept>

namespace btreekv {

void Pool::FlushFrame(Frame* f) {
  // TODO(4.3)
  (void)f;
  throw std::logic_error("TODO(4.3)");
}

}  // namespace btreekv
