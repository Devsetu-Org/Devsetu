#include "worktree/commit.h"
#include <stdexcept>

namespace tinygit {

Hash CommitWorktree(const Repo& r, const CommitOpts& opts) {
  // TODO(4.2): Require message. WriteTree. Parent = ResolveHEAD if present.
  // Author defaults to "tinygit <tinygit@devlabs>" plus unix time +0000.
  // PutCommit, then UpdateRef HEAD.
  throw std::runtime_error("TODO(4.2): CommitWorktree");
}

}  // namespace tinygit
