#include "raft/raft.h"
#include <stdexcept>
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
  // TODO(2.1): consistency check + AppendToLog + FollowerAdvanceCommit
  throw std::runtime_error("TODO(2.1): AppendEntries consistency check");
}

void Raft::AppendToLog(int prev_index, const std::vector<LogEntry>& entries) {
  (void)prev_index; (void)entries;
  // TODO(2.2)
  throw std::runtime_error("TODO(2.2): AppendToLog");
}

void Raft::BroadcastAppend() {
  last_broadcast_ = std::chrono::steady_clock::now();
  for (size_t i = 0; i < peers_.size(); ++i) {
    if (static_cast<int>(i) != me_) {
      int peer = static_cast<int>(i);
      std::thread([this, peer] { ReplicateTo(peer); }).detach();
    }
  }
}

void Raft::ReplicateTo(int peer) {
  (void)peer;
  // TODO(2.3)
  throw std::runtime_error("TODO(2.3): ReplicateTo");
}

std::tuple<int, int, bool> Raft::Start(const std::string& command) {
  (void)command;
  // TODO(2.4)
  throw std::runtime_error("TODO(2.4): Start");
}

}  // namespace raft
