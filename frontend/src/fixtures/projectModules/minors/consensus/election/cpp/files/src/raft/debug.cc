#include "raft/raft.h"

namespace raft {

State Raft::DebugState() {
  std::lock_guard<std::mutex> lk(mu_);
  State st;
  st.id = me_;
  st.term = current_term_;
  st.role = role_;
  st.voted_for = voted_for_;
  st.leader_id = leader_id_;
  if (log_.size() > 1) st.log.assign(log_.begin() + 1, log_.end());
  st.commit_index = commit_index_;
  st.last_applied = last_applied_;
  return st;
}

void Raft::DebugSeed(int term, const std::vector<LogEntry>& entries) {
  std::lock_guard<std::mutex> lk(mu_);
  current_term_ = term;
  log_.assign(1, LogEntry{});
  log_.insert(log_.end(), entries.begin(), entries.end());
  Persist();
}

void Raft::DebugElect() {
  std::lock_guard<std::mutex> lk(mu_);
  StartElection();
}

}  // namespace raft
