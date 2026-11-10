#include "kv/client.h"
#include <sstream>
#include <atomic>
#include <chrono>
#include <thread>
#include <unordered_map>
namespace kv {
static std::atomic<int64_t> next_id{1};
Clerk::Clerk(std::vector<std::shared_ptr<labrpc::ClientEnd>> ends)
  : ends_(std::move(ends)), id_(next_id.fetch_add(1)) {}
void Clerk::Put(const std::string& key, const std::string& value) {
  Do(Op{OpKind::Put, key, value, 0, 0});
}
void Clerk::Delete(const std::string& key) {
  Do(Op{OpKind::Delete, key, "", 0, 0});
}
std::pair<std::string, bool> Clerk::Get(const std::string& key) {
  auto r = Do(Op{OpKind::Get, key, "", 0, 0});
  return {r.value, r.found};
}
Result Clerk::Do(Op op) {
  ++seq_;
  op.client_id = id_;
  op.seq = seq_;
  auto deadline = std::chrono::steady_clock::now() + std::chrono::duration<double>(timeout_);
  std::unordered_map<int, int> failed_at;
  for (int attempt = 1; std::chrono::steady_clock::now() < deadline; ++attempt) {
    int server = leader_;
    std::string out;
    bool ok = ends_[server]->Call("KV.Execute", EncodeOp(op), &out);
    if (ok) {
      // parse reply
      std::istringstream in(out); std::string err; size_t n; char b; int found, leader;
      std::getline(in, err, '|');
      in >> n >> b; std::string value(n, '\0'); in.read(&value[0], n); in >> b >> found >> b >> leader >> b;
      if (err.empty()) return Result{value, found != 0};
      failed_at[server] = attempt;
      int next = (server + 1) % (int)ends_.size();
      if (err == kErrNotLeader && leader >= 0 && leader < (int)ends_.size()) {
        auto it = failed_at.find(leader);
        if (it == failed_at.end() || attempt - it->second >= (int)ends_.size()) next = leader;
      }
      leader_ = next;
    } else {
      failed_at[server] = attempt;
      leader_ = (server + 1) % (int)ends_.size();
    }
    if (attempt % (int)ends_.size() == 0) std::this_thread::sleep_for(std::chrono::milliseconds(25));
  }
  throw std::runtime_error("kv: unavailable");
}
}  // namespace kv
