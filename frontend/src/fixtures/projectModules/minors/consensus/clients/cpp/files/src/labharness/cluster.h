#pragma once
#include "labrpc/labrpc.h"
#include "raft/raft.h"
#include "storage/fence.h"
#include "storage/mem.h"
#include <atomic>
#include <functional>
#include <memory>
#include <mutex>
#include <string>
#include <thread>
#include <unordered_map>
#include <vector>

namespace labharness {

struct Options {
  raft::Timing timing = raft::FastTiming();
  int64_t seed = 1;
  bool manual = false;
  std::function<std::shared_ptr<storage::Store>(int)> stores;
};

class Cluster {
 public:
  Cluster(int n, Options opts = {});
  ~Cluster();
  void Shutdown();
  int N() const { return n_; }
  labrpc::Network* Net() { return net_.get(); }
  raft::Raft* Raft(int i);
  raft::State State(int i);
  void Disconnect(int i);
  void Connect(int i);
  void Partition(const std::vector<std::vector<int>>& groups);
  void Heal();
  void Crash(int i);
  void Restart(int i);
  bool Up(int i);
  void Campaign(int i);
  int CheckOneLeader(const std::vector<int>& nodes = {});
  void CheckNoLeader(double window_s, const std::vector<int>& nodes = {});
  void Eventually(double d, const std::string& msg, std::function<bool()> cond);
  void Fail(const std::string& msg);

  // monitor helpers
  std::mutex mu_;
  std::unordered_map<int, int> leaders_;
  std::string fatal_;

 private:
  void Start(int i);
  void Monitor();
  std::vector<int> Live(const std::vector<int>& nodes);
  std::pair<std::vector<int>, std::vector<int>> LeadersAmong(const std::vector<int>& set);

  int n_;
  Options opts_;
  std::unique_ptr<labrpc::Network> net_;
  std::vector<std::unique_ptr<raft::Raft>> rafts_;
  std::vector<std::vector<std::shared_ptr<labrpc::ClientEnd>>> ends_;
  std::vector<std::shared_ptr<storage::Store>> durable_;
  std::vector<std::shared_ptr<storage::Fenced>> fences_;
  std::vector<bool> up_, cut_;
  std::vector<int> gen_;
  std::atomic<bool> stop_{false};
  std::thread monitor_;
  bool shut_ = false;
};

}  // namespace labharness
