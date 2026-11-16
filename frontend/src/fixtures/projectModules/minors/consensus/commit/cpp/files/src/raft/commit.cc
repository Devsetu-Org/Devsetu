#include <algorithm>
#include "raft/raft.h"
#include <stdexcept>

namespace raft {
void Raft::AdvanceCommit() {
  // TODO(3.1)
  throw std::runtime_error("TODO(3.1)");
}
void Raft::FollowerAdvanceCommit(int leader_commit, int last_new) {
  (void)leader_commit; (void)last_new;
  // TODO(3.2)
  throw std::runtime_error("TODO(3.2)");
}
void Raft::ApplyLoop() {
  // TODO(3.3)
  throw std::runtime_error("TODO(3.3)");
}
}  // namespace raft
