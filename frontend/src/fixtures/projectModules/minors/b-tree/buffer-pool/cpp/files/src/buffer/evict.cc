#include "buffer/pool.h"

#include <stdexcept>

namespace btreekv {

int Pool::Victim() {
  // TODO(4.2): Clock: for up to 2*n steps, advance hand. Unused -> return.
  // Pinned -> skip. Ref set -> clear and skip. Else return index.
  // If every frame pinned, throw PoolFullError.
  throw std::logic_error("TODO(4.2): Victim");
}

}  // namespace btreekv
