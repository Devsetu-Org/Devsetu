#include "raft/raft.h"
#include <stdexcept>

namespace raft {

void Raft::BecomeFollower(int term) {
  // TODO(1.1)
  throw std::runtime_error("TODO(1.1)");
}

void Raft::StartElection() {
  // TODO(1.4)
  throw std::runtime_error("TODO(1.4)");
}

void Raft::HandleVoteReply(int term, const RequestVoteReply& reply, int* votes) {
  // TODO(1.5)
  throw std::runtime_error("TODO(1.5)");
}

void Raft::BecomeLeader() {
  // TODO(1.5)
  throw std::runtime_error("TODO(1.5)");
}

}  // namespace raft
