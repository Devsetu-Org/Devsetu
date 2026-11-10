#include "ref/update.h"
#include "ref/head.h"
#include "ref/ref.h"
#include <stdexcept>

namespace tinygit {

void UpdateRef(const Repo& r, const std::string& name, const Hash& new_hash, const Hash& old_hash) {
  // TODO(2.3): UpdateRef
  throw std::runtime_error("TODO(2.3): UpdateRef");
}

}  // namespace tinygit
