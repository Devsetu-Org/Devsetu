#include "kv/server.h"
#include <sstream>
#include "labrpc/labrpc.h"
#include <chrono>
namespace kv {
void Server::Apply(int index, const std::string& command) {
  Op op;
  try { op = DecodeOp(command); } catch (...) { return; }
  std::lock_guard<std::mutex> lk(mu_);
  Result r = state_.Apply(op);
  wait_result_[index] = Applied{op.client_id, op.seq, r};
  wait_done_[index] = true;
  if (auto it = wait_cv_.find(index); it != wait_cv_.end()) it->second->notify_all();
}
ExecuteReply Server::Execute(const ExecuteArgs& args) {
  ExecuteReply reply; reply.leader = -1;
  auto cv = std::make_shared<std::condition_variable_any>();
  int index = -1;
  {
    std::lock_guard<std::mutex> lk(mu_);
    auto [idx, term, is] = rf_->Start(EncodeOp(args.op));
    (void)term;
    if (!is) {
      reply.err = kErrNotLeader;
      reply.leader = rf_->Leader();
      return reply;
    }
    index = idx;
    wait_cv_[index] = cv;
    wait_done_[index] = false;
  }
  {
    std::unique_lock<std::mutex> lk(mu_);
    bool ok = cv->wait_for(lk, std::chrono::duration<double>(timeout_), [&] {
      return wait_done_[index];
    });
    if (!ok) {
      wait_cv_.erase(index);
      reply.err = kErrTimeout;
      return reply;
    }
    auto got = wait_result_[index];
    wait_cv_.erase(index);
    if (got.client_id != args.op.client_id || got.seq != args.op.seq) {
      reply.err = kErrNotLeader;
      reply.leader = rf_->Leader();
      return reply;
    }
    reply.value = got.result.value;
    reply.found = got.result.found;
  }
  return reply;
}
std::string Server::Handle(const std::string& method, const std::string& data) {
  if (method == "KV.Execute") {
    // simplistic: data is EncodeOp of the Op inside ExecuteArgs
    ExecuteArgs args; args.op = DecodeOp(data);
    auto reply = Execute(args);
    std::ostringstream o;
    o << reply.err << '|' << reply.value.size() << '|' << reply.value << '|'
      << (reply.found?1:0) << '|' << reply.leader << '|';
    return o.str();
  }
  if (method.rfind("Raft.", 0) == 0) return rf_->Handle(method, data);
  throw std::runtime_error("unknown");
}
std::unique_ptr<Server> StartServer(int me, std::vector<raft::Peer> peers,
    std::shared_ptr<storage::Store> store, raft::Timing timing, int64_t seed) {
  auto s = std::make_unique<Server>();
  s->me_ = me;
  raft::Config cfg;
  cfg.me = me; cfg.peers = std::move(peers); cfg.store = store; cfg.sm = s.get();
  cfg.timing = timing; cfg.seed = seed;
  s->rf_ = raft::Make(std::move(cfg));
  return s;
}
}  // namespace kv
