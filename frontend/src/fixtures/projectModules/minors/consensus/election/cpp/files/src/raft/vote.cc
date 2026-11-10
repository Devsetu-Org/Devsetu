#include "raft/raft.h"
#include <stdexcept>

namespace raft {

RequestVoteReply Raft::RequestVote(const RequestVoteArgs& args) {
  // TODO(1.3): grant at most one vote per term.
  throw std::runtime_error("TODO(1.3): RequestVote");
}

bool Raft::LogUpToDate(int last_term, int last_index) {
  // TODO(1.2): later last term wins, then longer log.
  throw std::runtime_error("TODO(1.2): LogUpToDate");
}

}  // namespace raft
