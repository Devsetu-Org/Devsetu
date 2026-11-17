#pragma once
#include "kv/op.h"
#include "kv/state.h"
#include "raft/raft.h"
#include <condition_variable>
#include <mutex>
#include <unordered_map>
namespace kv {
struct Applied { int64_t client_id, seq; Result result; };
class Server : public raft::StateMachine {
 public:
  void Apply(int index, const std::string& command) override;  // TODO 5.2
  ExecuteReply Execute(const ExecuteArgs& args);               // TODO 5.3
  raft::Raft* Raft() { return rf_.get(); }
  void Kill() { if (rf_) rf_->Kill(); }
  std::string Handle(const std::string& method, const std::string& data);
  int me_ = 0;
  std::unique_ptr<raft::Raft> rf_;
  double timeout_ = 0.600;
  std::mutex mu_;
  State state_;
  std::unordered_map<int, std::shared_ptr<std::condition_variable_any>> wait_cv_;
  std::unordered_map<int, Applied> wait_result_;
  std::unordered_map<int, bool> wait_done_;
};
std::unique_ptr<Server> StartServer(int me, std::vector<raft::Peer> peers,
    std::shared_ptr<storage::Store> store, raft::Timing timing, int64_t seed);
}  // namespace kv
