#include "raft/raft.h"
#include <algorithm>
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
  if (args.prev_log_index > LastLogIndex()) {
    reply.conflict_index = LastLogIndex() + 1;
    return reply;
  }
  int t = log_[args.prev_log_index].term;
  if (t != args.prev_log_term) {
    int i = args.prev_log_index;
    while (i > 1 && log_[i - 1].term == t) --i;
    reply.conflict_index = i;
    return reply;
  }
  AppendToLog(args.prev_log_index, args.entries);
  FollowerAdvanceCommit(args.leader_commit, args.prev_log_index + static_cast<int>(args.entries.size()));
  reply.success = true;
  return reply;
}

void Raft::AppendToLog(int prev_index, const std::vector<LogEntry>& entries) {
  bool changed = false;
  for (size_t k = 0; k < entries.size(); ++k) {
    int idx = prev_index + 1 + static_cast<int>(k);
    if (idx <= LastLogIndex()) {
      if (log_[idx].term == entries[k].term) continue;
      log_.resize(idx);
    }
    log_.push_back(entries[k]);
    changed = true;
  }
  if (changed) Persist();
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
  AppendEntriesArgs args;
  {
    std::lock_guard<std::mutex> lk(mu_);
    if (dead_.load() || role_ != Role::Leader) return;
    int nxt = next_index_[peer];
    args.term = current_term_;
    args.leader_id = me_;
    args.prev_log_index = nxt - 1;
    args.prev_log_term = log_[nxt - 1].term;
    args.entries.assign(log_.begin() + nxt, log_.end());
    args.leader_commit = commit_index_;
  }
  AppendEntriesReply reply;
  if (!SendAppendEntries(peer, args, &reply)) return;
  std::lock_guard<std::mutex> lk(mu_);
  if (reply.term > current_term_) { BecomeFollower(reply.term); return; }
  if (role_ != Role::Leader || current_term_ != args.term) return;
  if (reply.success) {
    int match = args.prev_log_index + static_cast<int>(args.entries.size());
    if (match > match_index_[peer]) match_index_[peer] = match;
    if (next_index_[peer] < match_index_[peer] + 1) next_index_[peer] = match_index_[peer] + 1;
    AdvanceCommit();
    return;
  }
  int back = std::max(reply.conflict_index, 1);
  if (back < next_index_[peer]) {
    next_index_[peer] = std::max(back, match_index_[peer] + 1);
    std::thread([this, peer] { ReplicateTo(peer); }).detach();
  }
}

std::tuple<int, int, bool> Raft::Start(const std::string& command) {
  std::lock_guard<std::mutex> lk(mu_);
  if (dead_.load() || role_ != Role::Leader) return {-1, current_term_, false};
  log_.push_back(LogEntry{current_term_, command});
  Persist();
  BroadcastAppend();
  return {LastLogIndex(), current_term_, true};
}

}  // namespace raft
