#include "raft/raft.h"
#include <stdexcept>

namespace raft {

void Raft::BecomeFollower(int term) {
  // TODO(1.1): set role_ = Follower; if term > current_term_, adopt term,
  // clear voted_for_ and leader_id_, Persist().
  throw std::runtime_error("TODO(1.1): BecomeFollower");
}

void Raft::StartElection() {
  // TODO(1.4): campaign — new term, vote for self, ask everyone concurrently.
  throw std::runtime_error("TODO(1.4): StartElection");
}

void Raft::HandleVoteReply(int term, const RequestVoteReply& reply, int* votes) {
  // TODO(1.5): count only fresh, granted votes.
  throw std::runtime_error("TODO(1.5): HandleVoteReply");
}

void Raft::BecomeLeader() {
  // TODO(1.5): take the job and announce it.
  throw std::runtime_error("TODO(1.5): BecomeLeader");
}

}  // namespace raft
