#include "raft/raft.h"

namespace raft {

RequestVoteReply Raft::RequestVote(const RequestVoteArgs& args) {
  std::lock_guard<std::mutex> lk(mu_);
  if (args.term > current_term_) BecomeFollower(args.term);
  RequestVoteReply reply;
  reply.term = current_term_;
  reply.vote_granted = false;
  if (args.term < current_term_) return reply;
  bool can_vote = voted_for_ == -1 || voted_for_ == args.candidate_id;
  if (can_vote && LogUpToDate(args.last_log_term, args.last_log_index)) {
    voted_for_ = args.candidate_id;
    Persist();
    ResetElectionTimer();
    reply.vote_granted = true;
  }
  return reply;
}

bool Raft::LogUpToDate(int last_term, int last_index) {
  if (last_term != LastLogTerm()) return last_term > LastLogTerm();
  return last_index >= LastLogIndex();
}

}  // namespace raft
