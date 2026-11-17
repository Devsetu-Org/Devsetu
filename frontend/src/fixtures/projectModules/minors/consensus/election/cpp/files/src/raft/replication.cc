#include "raft/raft.h"
#include <thread>

namespace raft {

AppendEntriesReply Raft::AppendEntries(const AppendEntriesArgs& args) {
  std::lock_guard<std::mutex> lk(mu_);
  AppendEntriesReply reply;
  reply.term = current_term_;
  reply.success = false;
  if (args.term < current_term_) return reply;
  BecomeFollower(args.term);
  leader_id_ = args.leader_id;
  ResetElectionTimer();
  reply.term = current_term_;
  reply.success = true;
  return reply;
}

void Raft::BroadcastAppend() {
  last_broadcast_ = std::chrono::steady_clock::now();
  for (size_t i = 0; i < peers_.size(); ++i) {
    if (static_cast<int>(i) != me_) {
      int peer = static_cast<int>(i);
      std::thread([this, peer] { SendHeartbeat(peer); }).detach();
    }
  }
}

void Raft::SendHeartbeat(int peer) {
  AppendEntriesArgs args;
  {
    std::lock_guard<std::mutex> lk(mu_);
    if (dead_.load() || role_ != Role::Leader) return;
    args.term = current_term_;
    args.leader_id = me_;
  }
  AppendEntriesReply reply;
  if (!SendAppendEntries(peer, args, &reply)) return;
  std::lock_guard<std::mutex> lk(mu_);
  if (reply.term > current_term_) BecomeFollower(reply.term);
}

std::tuple<int, int, bool> Raft::Start(const std::string& command) {
  (void)command;
  std::lock_guard<std::mutex> lk(mu_);
  return {-1, current_term_, false};
}

}  // namespace raft
