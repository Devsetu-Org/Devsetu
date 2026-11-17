#include "memtable/iterator.h"

#include <stdexcept>

namespace lsmkv {

void Iterator::Seek(std::string_view target) {
  // ── TODO(1.4) — reuse the search ──────────────────────────────────────────
  (void)target;
  throw std::logic_error("TODO(1.4)");
}

void Iterator::Next() {
  // ── TODO(1.4) — level 0 is the full sorted list ───────────────────────────
  throw std::logic_error("TODO(1.4)");
}

}  // namespace lsmkv
