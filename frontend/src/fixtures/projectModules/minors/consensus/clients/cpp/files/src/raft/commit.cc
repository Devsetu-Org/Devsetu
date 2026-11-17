#include <algorithm>
#include "raft/raft.h"

namespace raft {
void Raft::AdvanceCommit() {
  if (role_ != Role::Leader) return;
  for (int n = LastLogIndex(); n > commit_index_; --n) {
    if (log_[n].term != current_term_) return;
    int replicas = 1;
    for (size_t i = 0; i < peers_.size(); ++i) {
      if (static_cast<int>(i) != me_ && match_index_[i] >= n) ++replicas;
    }
    if (replicas >= Majority()) {
      commit_index_ = n;
      apply_cond_.notify_all();
      return;
    }
  }
}
void Raft::FollowerAdvanceCommit(int leader_commit, int last_new) {
  int c = std::min(leader_commit, last_new);
  if (c > commit_index_) {
    commit_index_ = c;
    apply_cond_.notify_all();
  }
}
void Raft::ApplyLoop() {
  std::unique_lock<std::mutex> lk(mu_);
  while (!dead_.load()) {
    if (last_applied_ >= commit_index_) {
      apply_cond_.wait(lk);
      continue;
    }
    int first = last_applied_ + 1;
    std::vector<LogEntry> batch(log_.begin() + first, log_.begin() + commit_index_ + 1);
    last_applied_ = commit_index_;
    lk.unlock();
    for (size_t k = 0; k < batch.size(); ++k) {
      if (Killed()) break;
      if (sm_) sm_->Apply(first + static_cast<int>(k), batch[k].command);
    }
    lk.lock();
  }
}
}  // namespace raft
