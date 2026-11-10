#pragma once
#include "labrpc/labrpc.h"
#include "storage/store.h"
#include <atomic>
#include <chrono>
#include <condition_variable>
#include <cstdint>
#include <memory>
#include <mutex>
#include <random>
#include <string>
#include <thread>
#include <vector>

namespace raft {

enum class Role { Follower, Candidate, Leader };

struct LogEntry {
  int term = 0;
  std::string command;
};

struct Timing {
  double election_min = 0.150;
  double election_max = 0.300;
  double heartbeat = 0.030;
  double tick = 0.005;
};

inline Timing DefaultTiming() { return Timing{}; }
inline Timing FastTiming() {
  return Timing{0.120, 0.240, 0.025, 0.004};
}

struct RequestVoteArgs {
  int term = 0;
  int candidate_id = 0;
  int last_log_index = 0;
  int last_log_term = 0;
};
struct RequestVoteReply {
  int term = 0;
  bool vote_granted = false;
};
struct AppendEntriesArgs {
  int term = 0;
  int leader_id = 0;
  int prev_log_index = 0;
  int prev_log_term = 0;
  std::vector<LogEntry> entries;
  int leader_commit = 0;
};
struct AppendEntriesReply {
  int term = 0;
  bool success = false;
  int conflict_index = 0;
};

struct State {
  int id = 0;
  int term = 0;
  Role role = Role::Follower;
  int voted_for = -1;
  int leader_id = -1;
  std::vector<LogEntry> log;
  int commit_index = 0;
  int last_applied = 0;
};

class StateMachine {
 public:
  virtual ~StateMachine() = default;
  virtual void Apply(int index, const std::string& command) = 0;
};

using Peer = std::shared_ptr<labrpc::ClientEnd>;

struct Config {
  int me = 0;
  std::vector<Peer> peers;
  std::shared_ptr<storage::Store> store;
  StateMachine* sm = nullptr;
  Timing timing = DefaultTiming();
  int64_t seed = 1;
};

class Raft {
 public:
  explicit Raft(Config cfg);
  ~Raft();
  void Kill();
  bool Killed();
  std::pair<int, bool> GetState();
  int Leader();
  // Student tasks (election/vote) and later chapters:
  void BecomeFollower(int term);           // TODO 1.1
  bool LogUpToDate(int last_term, int last_index);  // TODO 1.2
  RequestVoteReply RequestVote(const RequestVoteArgs& args);  // TODO 1.3
  void StartElection();                    // TODO 1.4
  void HandleVoteReply(int term, const RequestVoteReply& reply, int* votes);  // TODO 1.5
  void BecomeLeader();                     // TODO 1.5

  AppendEntriesReply AppendEntries(const AppendEntriesArgs& args);
  void BroadcastAppend();
  std::tuple<int, int, bool> Start(const std::string& command);

  void AdvanceCommit();
  void FollowerAdvanceCommit(int leader_commit, int last_new);
  void ApplyLoop();

  void Persist();
  void ReadPersist();

  std::string Handle(const std::string& method, const std::string& data);
  State DebugState();
  void DebugSeed(int term, const std::vector<LogEntry>& entries);
  void DebugElect();

  // Serialization helpers used by service/rpc.
  static std::string EncodeRVArgs(const RequestVoteArgs& a);
  static RequestVoteArgs DecodeRVArgs(const std::string& s);
  static std::string EncodeRVReply(const RequestVoteReply& r);
  static RequestVoteReply DecodeRVReply(const std::string& s);
  static std::string EncodeAEArgs(const AppendEntriesArgs& a);
  static AppendEntriesArgs DecodeAEArgs(const std::string& s);
  static std::string EncodeAEReply(const AppendEntriesReply& r);
  static AppendEntriesReply DecodeAEReply(const std::string& s);

  // Exposed for tests/helpers under lock discipline.
  std::mutex mu_;
  std::condition_variable_any apply_cond_;

  int me_ = 0;
  std::vector<Peer> peers_;
  std::shared_ptr<storage::Store> store_;
  StateMachine* sm_ = nullptr;
  Timing timing_;
  std::mt19937_64 rng_;
  std::atomic<bool> dead_{false};

  int current_term_ = 0;
  int voted_for_ = -1;
  std::vector<LogEntry> log_;  // [0] sentinel
  Role role_ = Role::Follower;
  int leader_id_ = -1;
  int commit_index_ = 0;
  int last_applied_ = 0;
  std::vector<int> next_index_;
  std::vector<int> match_index_;
  std::chrono::steady_clock::time_point election_deadline_{};
  std::chrono::steady_clock::time_point last_broadcast_{};

  void ResetElectionTimer();  // mu held
  int LastLogIndex() const;
  int LastLogTerm() const;
  int Majority() const;
  void ResetLeaderProgress();
  bool SendRequestVote(int peer, const RequestVoteArgs& args, RequestVoteReply* reply);
  bool SendAppendEntries(int peer, const AppendEntriesArgs& args, AppendEntriesReply* reply);
  void SendHeartbeat(int peer);
  void Ticker();

 private:
  std::thread ticker_;
  std::thread applier_;
};

std::unique_ptr<Raft> Make(Config cfg);

inline const char* RoleName(Role r) {
  switch (r) {
    case Role::Follower: return "follower";
    case Role::Candidate: return "candidate";
    case Role::Leader: return "leader";
  }
  return "unknown";
}

}  // namespace raft
