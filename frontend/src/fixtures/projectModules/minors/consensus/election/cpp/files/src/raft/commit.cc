#include "raft/raft.h"
namespace raft {
void Raft::AdvanceCommit() {}
void Raft::FollowerAdvanceCommit(int, int) {}
void Raft::ApplyLoop() {}
}  // namespace raft
