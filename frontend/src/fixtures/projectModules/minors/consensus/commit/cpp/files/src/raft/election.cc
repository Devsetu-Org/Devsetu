#include "raft/raft.h"
#include <thread>

namespace raft {

void Raft::BecomeFollower(int term) {
  role_ = Role::Follower;
  if (term > current_term_) {
    current_term_ = term;
    voted_for_ = -1;
    leader_id_ = -1;
    Persist();
  }
}

void Raft::StartElection() {
  role_ = Role::Candidate;
  ++current_term_;
  voted_for_ = me_;
  leader_id_ = -1;
  Persist();
  ResetElectionTimer();

  int term = current_term_;
  RequestVoteArgs args{term, me_, LastLogIndex(), LastLogTerm()};
  auto votes = std::make_shared<int>(1);
  if (*votes >= Majority()) {
    BecomeLeader();
    return;
  }
  for (size_t i = 0; i < peers_.size(); ++i) {
    if (static_cast<int>(i) == me_) continue;
    int peer = static_cast<int>(i);
    std::thread([this, peer, args, term, votes]() {
      RequestVoteReply reply;
      if (!SendRequestVote(peer, args, &reply)) return;
      std::lock_guard<std::mutex> lk(mu_);
      HandleVoteReply(term, reply, votes.get());
    }).detach();
  }
}

void Raft::HandleVoteReply(int term, const RequestVoteReply& reply, int* votes) {
  if (reply.term > current_term_) {
    BecomeFollower(reply.term);
    return;
  }
  if (role_ != Role::Candidate || current_term_ != term || !reply.vote_granted) return;
  ++(*votes);
  if (*votes >= Majority()) BecomeLeader();
}

void Raft::BecomeLeader() {
  role_ = Role::Leader;
  leader_id_ = me_;
  ResetLeaderProgress();
  BroadcastAppend();
}

}  // namespace raft
