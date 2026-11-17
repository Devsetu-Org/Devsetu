#include "raft/raft.h"
#include <stdexcept>

namespace raft {

RequestVoteReply Raft::RequestVote(const RequestVoteArgs& args) {
  // TODO(1.3)
  throw std::runtime_error("TODO(1.3)");
}

bool Raft::LogUpToDate(int last_term, int last_index) {
  // TODO(1.2)
  throw std::runtime_error("TODO(1.2)");
}

}  // namespace raft
