#include "worktree/write_tree.h"
#include <stdexcept>

namespace tinygit {

Hash WriteTree(const Repo& r) {
  // TODO(4.1): Load index. Build a nested map by splitting paths on "/".
  // Recursively PutTree: files are kModeFile entries; dirs become kModeTree children.
  throw std::runtime_error("TODO(4.1): WriteTree");
}

}  // namespace tinygit
