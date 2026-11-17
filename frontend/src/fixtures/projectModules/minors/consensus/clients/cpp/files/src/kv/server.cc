#include "kv/server.h"
#include <stdexcept>
namespace kv {
void Server::Apply(int index, const std::string& command) {
  // TODO(5.2)
  throw std::runtime_error("TODO(5.2)");
}
ExecuteReply Server::Execute(const ExecuteArgs& args) {
  // TODO(5.3)
  throw std::runtime_error("TODO(5.3)");
}
std::string Server::Handle(const std::string& method, const std::string& data) {
  (void)method; (void)data;
  throw std::runtime_error("kv Handle stub");
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
