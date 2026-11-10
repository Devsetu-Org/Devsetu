#include "raft/raft.h"
#include <utility>

namespace raft {

Raft::Raft(Config cfg)
    : me_(cfg.me),
      peers_(std::move(cfg.peers)),
      store_(std::move(cfg.store)),
      sm_(cfg.sm),
      timing_(cfg.timing),
      rng_(static_cast<uint64_t>(cfg.seed + cfg.me * 7919)) {
  log_.push_back(LogEntry{});
  next_index_.assign(peers_.size(), 0);
  match_index_.assign(peers_.size(), 0);
  ReadPersist();
  {
    std::lock_guard<std::mutex> lk(mu_);
    ResetElectionTimer();
  }
  ticker_ = std::thread([this] { Ticker(); });
  applier_ = std::thread([this] { ApplyLoop(); });
}

Raft::~Raft() {
  Kill();
  if (ticker_.joinable()) ticker_.join();
  if (applier_.joinable()) applier_.join();
}

void Raft::Kill() {
  dead_.store(true);
  apply_cond_.notify_all();
}
bool Raft::Killed() { return dead_.load(); }

std::pair<int, bool> Raft::GetState() {
  std::lock_guard<std::mutex> lk(mu_);
  return {current_term_, role_ == Role::Leader};
}
int Raft::Leader() {
  std::lock_guard<std::mutex> lk(mu_);
  return role_ == Role::Leader ? me_ : leader_id_;
}

void Raft::Ticker() {
  while (!Killed()) {
    std::this_thread::sleep_for(std::chrono::duration<double>(timing_.tick));
    std::lock_guard<std::mutex> lk(mu_);
    if (dead_.load()) return;
    auto now = std::chrono::steady_clock::now();
    if (role_ == Role::Leader) {
      if (now - last_broadcast_ >=
          std::chrono::duration_cast<std::chrono::steady_clock::duration>(
              std::chrono::duration<double>(timing_.heartbeat))) {
        ResetElectionTimer();
        BroadcastAppend();
      }
    } else if (now > election_deadline_) {
      StartElection();
    }
  }
}

void Raft::ResetElectionTimer() {
  double span = timing_.election_max - timing_.election_min;
  double d = timing_.election_min;
  if (span > 0) {
    std::uniform_real_distribution<double> dist(0, span);
    d += dist(rng_);
  }
  election_deadline_ =
      std::chrono::steady_clock::now() +
      std::chrono::duration_cast<std::chrono::steady_clock::duration>(
          std::chrono::duration<double>(d));
}

int Raft::LastLogIndex() const { return static_cast<int>(log_.size()) - 1; }
int Raft::LastLogTerm() const { return log_.back().term; }
int Raft::Majority() const { return static_cast<int>(peers_.size()) / 2 + 1; }
void Raft::ResetLeaderProgress() {
  for (size_t i = 0; i < peers_.size(); ++i) {
    next_index_[i] = LastLogIndex() + 1;
    match_index_[i] = 0;
  }
}

bool Raft::SendRequestVote(int peer, const RequestVoteArgs& args, RequestVoteReply* reply) {
  std::string out;
  if (!peers_[peer]->Call("Raft.RequestVote", EncodeRVArgs(args), &out)) return false;
  *reply = DecodeRVReply(out);
  return true;
}
bool Raft::SendAppendEntries(int peer, const AppendEntriesArgs& args, AppendEntriesReply* reply) {
  std::string out;
  if (!peers_[peer]->Call("Raft.AppendEntries", EncodeAEArgs(args), &out)) return false;
  *reply = DecodeAEReply(out);
  return true;
}

std::unique_ptr<Raft> Make(Config cfg) { return std::make_unique<Raft>(std::move(cfg)); }

}  // namespace raft
