#include "db/db.h"

#include "btree/tree.h"

#include <stdexcept>

namespace btreekv {

void ScanImpl(DB* d, std::string_view start, std::string_view end,
              const std::function<bool(std::string_view, std::string_view)>& fn) {
  // TODO(5.4)
  (void)d;
  (void)start;
  (void)end;
  (void)fn;
  throw std::logic_error("TODO(5.4)");
}

}  // namespace btreekv
