#include <algorithm>
#include "raft/raft.h"
#include <stdexcept>

namespace raft {
void Raft::AdvanceCommit() {
  throw std::runtime_error("TODO(3.1): AdvanceCommit");
}
void Raft::FollowerAdvanceCommit(int leader_commit, int last_new) {
  (void)leader_commit; (void)last_new;
  throw std::runtime_error("TODO(3.2): FollowerAdvanceCommit");
}
void Raft::ApplyLoop() {
  throw std::runtime_error("TODO(3.3): ApplyLoop");
}
}  // namespace raft
